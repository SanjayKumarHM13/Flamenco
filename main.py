from mpi4py import MPI
import asyncio
from collections import deque
import logging
import psutil
import platform
import os
import torch
import torch.nn as nn
import pickle
import numpy as np
from execution.mt5_router import MT5Router

from config import SCALER_PATH, MASTER_MODEL_PATH, SEQUENCE_LENGTH, MT5_ACCOUNT, MT5_PASSWORD, MT5_SERVER, TOTAL_PORTFOLIO_VALUE
from mpi.worker import async_worker_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RegimeLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_classes):
        super(RegimeLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers=2, batch_first=True)
        self.fc = nn.Linear(hidden_size, num_classes)
        
    def forward(self, x):
        out, _ = self.lstm(x)
        out = out[:, -1, :] 
        out = self.fc(out)
        return out

import json
from websockets.sync.client import connect
import datetime

def calculate_kelly_size(ai_confidence, win_loss_ratio=1.0, safety_fraction=0.5):
    """
    Calculates the percentage of the total portfolio to risk on a single pair.
    
    :param ai_confidence: The probability from the Worker XGBoost (0.0 to 1.0).
    :param win_loss_ratio: Average Take Profit divided by Average Stop Loss.
    :param safety_fraction: 0.5 is "Half-Kelly". Full Kelly is often too aggressive.
    """
    # If the AI thinks we lose more than 50% of the time, risk nothing.
    if ai_confidence <= 0.50:
        return 0.0
        
    prob_loss = 1.0 - ai_confidence
    
    # Standard Kelly Formula: p - (q / b)
    kelly_percentage = ai_confidence - (prob_loss / win_loss_ratio)
    
    # Apply the safety multiplier (Half-Kelly)
    safe_kelly = kelly_percentage * safety_fraction
    
    # Hard cap the maximum risk at 10% of the portfolio per trade to prevent ruin
    max_risk = min(safe_kelly, 0.10)
    
    # Ensure we don't return negative sizes
    return max(0.0, max_risk)

async def master_loop(comm):
    logger.info("\t\t[MASTER] Master node initialized. Waiting for signals...")

    ws_conn = None
    def send_to_frontend(payload):
        nonlocal ws_conn
        try:
            if not ws_conn:
                # Disable keepalive pings — MPI blocks prevent responding to them
                ws_conn = connect("ws://127.0.0.1:3000/ws/dashboard", open_timeout=10, close_timeout=5)
            ws_conn.send(json.dumps({"action": "backend_update", "payload": payload}))
        except Exception as e:
            logger.error(f"WS error: {e}")
            try:
                if ws_conn:
                    ws_conn.close()
            except:
                pass
            ws_conn = None

    def broadcast_ws(current_signals, danger_ratio=0.0, exec_orders=None, is_danger=False, status_override=None):
        if exec_orders is None: exec_orders = {}
        pairs_dict = {}
        now_iso = datetime.datetime.now().isoformat() + "Z"
        
        for sig in current_signals:
            if sig is not None:
                d = "Flat"
                if sig.z_score > 2.0: d = "Short"
                elif sig.z_score < -2.0: d = "Long"
                pairs_dict[sig.pair] = {
                    "z": float(sig.z_score), "spread": float(sig.spread), "sig": d,
                    "xgb": float(sig.ai_confidence), "k": exec_orders.get(sig.pair, 0.0),
                    "pnl": 0.0, "p_trend": [0.0]*20, "beta_var": float(sig.variance),
                    "features": {"Z-Score": abs(sig.z_score), "AI Conf": sig.ai_confidence}
                }
                if status_override is None:
                    send_to_frontend({"log": {"t": now_iso, "msg": f"[{sig.pair}] Z: {sig.z_score:5.2f} | AI: {sig.ai_confidence*100:05.2f}%", "type": "ai"}})
                    
        ticker_data = {"g_conf": float(1.0 - danger_ratio), "pos": len(exec_orders), "pnl": 0.0, "pairs": pairs_dict}
        regime = "MEAN_REVERTING" if status_override == "WARMING" else ("TRENDING" if is_danger else "MEAN_REVERTING")
        sys_data = {
            "circuit_breaker": {"status": "Armed", "used": 0.0},
            "nodes": {
                "Rank0": {
                    "role": "Master", 
                    "host": platform.node(), 
                    "cpu": psutil.cpu_percent(), 
                    "ram": int(psutil.virtual_memory().used / (1024 * 1024)), 
                    "cores": os.cpu_count() or 1,
                    "status": "Online"
                }
            },
            "pair_stats": {},
            "lstm": {"regime": regime, "confidence": float(1.0 - danger_ratio), "heatmap": [[0.0]*60]*7},
            "meta_allocations": []
        }
        for i, sig in enumerate(current_signals):
            if sig is not None:
                sys_data["nodes"][f"Rank{sig.rank}"] = {
                    "role": "Worker", 
                    "pair": sig.pair, 
                    "host": sig.hostname, 
                    "cpu": sig.cpu, 
                    "ram": int(sig.ram), 
                    "cores": sig.cores,
                    "status": "Online"
                }
                sys_data["meta_allocations"].append({"pair": sig.pair, "prob": float(sig.ai_confidence), "allocated": sig.pair in exec_orders, "kelly": exec_orders.get(sig.pair, 0.0)})
                sys_data["pair_stats"][sig.pair] = {"beta": float(sig.beta), "halfLife": int(sig.half_life), "trades": "Active" if sig.pair in exec_orders else "Watching"}
        
        logger.info(f"\t\t[MASTER] Sending data to frontend: {len(current_signals)} signals, {len(sys_data['nodes'])} nodes")
        
        send_to_frontend({"ticker": ticker_data, "system": sys_data, "equity": {"t": now_iso, "balance": TOTAL_PORTFOLIO_VALUE}})

    logger.info("\t\t[MASTER] Loading LSTM Model...")
    device = torch.device("cpu") # Keep inference on CPU to avoid MPI/CUDA conflicts

    model = RegimeLSTM(input_size=5, hidden_size=32, num_classes=2).to(device)
    model.load_state_dict(torch.load(MASTER_MODEL_PATH, map_location=device))

    model.eval()

    with open(SCALER_PATH, 'rb') as f:
        scaler = pickle.load(f)

    logger.info("\t\t[MASTER] LSTM Model loaded successfully.")

    router = MT5Router(MT5_ACCOUNT, MT5_PASSWORD, MT5_SERVER)

    market_memory = {}
    latest_signals = {}  # Persistent cache: { pair_name: TradeSignal }

    while True:
        try:
            # 1. Non-blocking check for signals from ANY worker
            new_signals = []
            for r in range(1, comm.Get_size()):
                if comm.Iprobe(source=r):
                    sig = comm.recv(source=r)
                    if sig:
                        new_signals.append(sig)
                        latest_signals[sig.pair] = sig  # Always keep the latest
            
            if not new_signals:
                await asyncio.sleep(0.1)
                continue

            # Use the full accumulated view for broadcasting
            signals = list(latest_signals.values())
            
            # Only add NEW data points to market memory (avoid duplicates from cache)
            for sig in new_signals:
                if sig is not None:
                    if sig.pair not in market_memory:
                        market_memory[sig.pair] = deque(maxlen=SEQUENCE_LENGTH)
                    
                    snapshot = [
                        sig.z_score,
                        sig.half_life,
                        sig.variance,
                        sig.beta,
                        sig.spread
                    ]
                    market_memory[sig.pair].append(snapshot)

            if not market_memory:
                logger.info("\t\t[MASTER] Waiting for first signals from workers...")
                continue

            # Check if Memory is Full (Ready for AI)
            # The Master cannot predict the regime until it has 60 full bars
            is_warmed_up = all(len(dq) == SEQUENCE_LENGTH for dq in market_memory.values())

            if not is_warmed_up:
                min_bars = min(len(dq) for dq in market_memory.values()) if market_memory else 0
                logger.info(f"\t\t[MASTER] Warming up: {min_bars}/{SEQUENCE_LENGTH} bars ({len(market_memory)} pairs, {len(signals)} nodes)")
                broadcast_ws(signals, status_override="WARMING")
                continue
            
            # ==========================================
            # THE LSTM REGIME INFERENCE
            # ==========================================
            trending_votes = 0
            trending_pairs = []

            for pair, memory_queue in market_memory.items():
                seq_array = np.array(memory_queue)
                # Ensure we have all 5 features: z_score, half_life, variance, beta, spread
                features_only = seq_array[:, :5] 
                
                seq_scaled = scaler.transform(features_only)
                seq_tensor = torch.FloatTensor(seq_scaled).unsqueeze(0).to(device)
                
                with torch.no_grad():
                    output = model(seq_tensor)
                    _, predicted = torch.max(output.data, 1)
                    regime_id = predicted.item()
                    
                if regime_id == 1:
                    trending_votes += 1
                    trending_pairs.append(pair)

            # ==========================================
            # THE KILL SWITCH LOGIC (CONSENSUS)
            # ==========================================
            # Instead of ANY pair, we block if > 33% of the portfolio is unstable
            num_pairs = len(market_memory)
            danger_ratio = trending_votes / num_pairs if num_pairs > 0 else 0
            is_global_danger = (danger_ratio > 0.33)
            
            if is_global_danger:
                logger.info(f"\t\t[MASTER] GLOBAL REGIME: TRENDING / UNSTABLE ({trending_votes}/{num_pairs} pairs)")
                logger.info(f"\t\t[MASTER] BLOCKING SIGNALS: Currently unstable: {', '.join(trending_pairs)}")
            else:
                logger.info(f"\t\t[MASTER] GLOBAL REGIME: MEAN-REVERTING (SAFE)")
                if trending_pairs:
                    logger.info(f"\t\t[MASTER] Note: Minor instability in {', '.join(trending_pairs)} but below threshold.")
            
            print("-" * 60)
            
            # Print the Worker Signals and apply the Kill Switch
            for sig in signals:
                if sig is not None:
                    status = "IGNORE"
                    
                    if is_global_danger:
                        status = "BLOCKED BY LSTM"
                    elif sig.ai_confidence > 0.65:
                        status = "APPROVED (Trade Setup)"
                    elif sig.ai_confidence > 0.40:
                        status = "WATCHING"
                        
                    logger.info(f"\t\t[MASTER] [{sig.pair}] Worker XGB: {sig.ai_confidence*100:05.2f}% | Z: {sig.z_score:5.2f} | {status}")
            
            print("="*60)

            # ==========================================
            # PORTFOLIO ALLOCATION (KELLY)
            # ==========================================
            print("-" * 60)
            
            # This dictionary will hold the final orders to be sent to MT5/Binance
            # Format: { "BTCUSDT/ETHUSDT": 0.04 } (meaning allocate 4% of capital)
            execution_orders = {}
            
            for sig in signals:
                if sig is not None:
                    allocation = 0.0
                    status = "IGNORE"
                    
                    if is_global_danger:
                        status = "BLOCKED BY LSTM"
                    elif sig.ai_confidence > 0.65:
                        # 1. The AI is confident, and the market is safe.
                        # 2. Calculate the exact bet size.
                        allocation = calculate_kelly_size(sig.ai_confidence)
                        
                        # Convert to percentage for display (e.g., 0.04 -> 4.0%)
                        alloc_pct = allocation * 100 
                        status = f"APPROVED | RISK SIZE: {alloc_pct:.1f}%"
                        
                        if allocation > 0:
                            execution_orders[sig.pair] = allocation
                            
                    elif sig.ai_confidence > 0.40:
                        status = "WATCHING (Edge too low for Kelly)"
                        
                    print(f"[{sig.pair}] Worker XGB: {sig.ai_confidence*100:05.2f}% | Z: {sig.z_score:5.2f} | {status}")
            
            if execution_orders:
                logger.info(f"\n[MASTER] ROUTING {len(execution_orders)} AI TRADES TO METATRADER 5 (Capital: ${TOTAL_PORTFOLIO_VALUE})")
                for pair, pct_size in execution_orders.items():
                    # 1. Calculate real dollar value based on Kelly percentage
                    capital_to_risk = TOTAL_PORTFOLIO_VALUE * pct_size
                    logger.info(f"\t -> Pair {pair} | Risk: ${capital_to_risk:.2f} ({pct_size*100:.2f}%)")
                    
                    # 2. Find the specific TradeSignal object for this pair to get prices and Z-score
                    target_signal = next(sig for sig in signals if sig is not None and sig.pair == pair)
                    
                    # 3. Fire the trades directly into MT5
                    router.route_spread_trade(
                        pair_name=pair, 
                        total_dollar_risk=capital_to_risk, 
                        price_y=target_signal.price_y, # Ensure these are in your TradeSignal dataclass!
                        price_x=target_signal.price_x, 
                        z_score=target_signal.z_score
                    )
            
            print("="*60)

            # --- WebSocket Sync to Frontend ---
            broadcast_ws(signals, danger_ratio=danger_ratio, exec_orders=execution_orders, is_danger=is_global_danger)
        

        except Exception as e:
            logger.error(f"\t[MASTER] Master loop error: {e}")
            break

        import time
        time.sleep(0.1)

def setup_logging(rank):
    """Configure per-rank logging to separate files."""
    import os
    os.makedirs("logs", exist_ok=True)

    # Clear all existing handlers from root logger
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s | %(name)s | %(message)s", datefmt="%H:%M:%S")

    if rank == 0:
        log_file = "logs/master.log"
    else:
        log_file = f"logs/worker_{rank}.log"

    # File handler (each rank writes to its own file)
    fh = logging.FileHandler(log_file, mode="w", encoding="utf-8")
    fh.setLevel(logging.INFO)
    fh.setFormatter(fmt)
    root_logger.addHandler(fh)

    # Console handler (keep for master only, suppress workers to avoid interleaving)
    if rank == 0:
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)
        ch.setFormatter(fmt)
        root_logger.addHandler(ch)

if __name__ == "__main__":

	comm = MPI.COMM_WORLD

	rank = comm.Get_rank()

	setup_logging(rank)

	if rank == 0:
		asyncio.run(master_loop(comm))
	else:
		asyncio.run(async_worker_engine(comm, rank))