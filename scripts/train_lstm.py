from mpi4py import MPI
import asyncio
from collections import deque
import logging
import torch
import torch.nn as nn
import pickle
import numpy as np
import json
import datetime
import threading
import queue
from websockets.sync.client import connect

from execution.mt5_router import MT5Router
from config import (SCALER_PATH, MASTER_MODEL_PATH, SEQUENCE_LENGTH, 
                    MT5_ACCOUNT, MT5_PASSWORD, MT5_SERVER, TOTAL_PORTFOLIO_VALUE)
from mpi.worker import async_worker_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==========================================
# LSTM MODEL
# ==========================================
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

# ==========================================
# KELLY ALLOCATOR
# ==========================================
def calculate_kelly_size(ai_confidence, win_loss_ratio=1.0, safety_fraction=0.5):
    if ai_confidence <= 0.50:
        return 0.0
    prob_loss = 1.0 - ai_confidence
    kelly_percentage = ai_confidence - (prob_loss / win_loss_ratio)
    safe_kelly = kelly_percentage * safety_fraction
    max_risk = min(safe_kelly, 0.10)
    return max(0.0, max_risk)

# ==========================================
# WEBSOCKET DAEMON THREAD
# ==========================================
# Queue maxsize=5 prevents memory leaks if the backend goes down.
# We'd rather drop old telemetry frames than crash the trading engine.
telemetry_queue = queue.Queue(maxsize=5)

def websocket_worker():
    """Runs in the background, entirely separate from the MPI loop."""
    ws_conn = None
    url = "ws://127.0.0.1:3000/ws/dashboard"
    
    while True:
        # Blocks until the Master node puts data in the queue
        payload = telemetry_queue.get() 
        
        try:
            if ws_conn is None:
                ws_conn = connect(url)
            
            ws_conn.send(json.dumps({"action": "backend_update", "payload": payload}))
            
        except Exception as e:
            # If the backend disconnects, silently log it and reset the connection.
            # Notice this DOES NOT crash the Master loop!
            logger.error(f"[TELEMETRY THREAD] WS error: {e}")
            if ws_conn:
                try: ws_conn.close() 
                except: pass
            ws_conn = None
        finally:
            telemetry_queue.task_done()

def send_to_frontend(payload):
    """Safely drops the payload into the thread queue."""
    try:
        # If queue is full (backend is slow), remove oldest frame to insert newest
        if telemetry_queue.full():
            telemetry_queue.get_nowait()
        telemetry_queue.put_nowait(payload)
    except Exception:
        pass

# ==========================================
# MASTER NODE
# ==========================================
def master_loop(comm):
    logger.info("\t\t[MASTER] Master node initialized. Waiting for signals...")

    # Start the background telemetry thread
    ws_thread = threading.Thread(target=websocket_worker, daemon=True)
    ws_thread.start()

    def broadcast_ws(current_signals, danger_ratio=0.0, exec_orders=None, is_danger=False, status_override=None):
        if exec_orders is None: exec_orders = {}
        pairs_dict = {}
        now_iso = datetime.datetime.now().isoformat() + "Z"
        
        for sig in current_signals:
            if sig is not None:
                d = "Flat"
                if sig.z_score > 2.0: d = "Short"
                elif sig.z_score < -2.0: d = "Long"
                
                # IMPORTANT: Cast everything to native Python float/int to prevent JSON serialization crashes
                pairs_dict[sig.pair] = {
                    "z": float(sig.z_score), "spread": float(sig.spread), "sig": d,
                    "xgb": float(sig.ai_confidence), "k": float(exec_orders.get(sig.pair, 0.0)),
                    "pnl": 0.0, "p_trend": [0.0]*20, "beta_var": float(sig.variance),
                    "features": {"Z-Score": float(abs(sig.z_score)), "AI Conf": float(sig.ai_confidence)}
                }
                
                if status_override is None:
                    # Send individual logs
                    send_to_frontend({"log": {"t": now_iso, "msg": f"[{sig.pair}] Z: {sig.z_score:5.2f} | AI: {sig.ai_confidence*100:05.2f}%", "type": "ai"}})
                    
        ticker_data = {"g_conf": float(1.0 - danger_ratio), "pos": len(exec_orders), "pnl": 0.0, "pairs": pairs_dict}
        regime = "MEAN_REVERTING" if status_override == "WARMING" else ("TRENDING" if is_danger else "MEAN_REVERTING")
        
        # Fixed the 2D array referencing bug ( [[0.0]*60]*7 creates linked references )
        heatmap_safe = [[0.0 for _ in range(60)] for _ in range(7)]
        
        sys_data = {
            "circuit_breaker": {"status": "Armed", "used": 0.0},
            "nodes": {"Rank0": {"role": "Master", "host": "Master Node", "cpu": 8, "ram": 290, "status": "Online"}},
            "pair_stats": {},
            "lstm": {"regime": regime, "confidence": float(1.0 - danger_ratio), "heatmap": heatmap_safe},
            "meta_allocations": []
        }
        
        for i, sig in enumerate(current_signals):
            if sig is not None:
                sys_data["nodes"][f"Rank{sig.rank}"] = {"role": "Worker", "pair": sig.pair, "host": f"Node {sig.rank}", "cpu": 4, "ram": 256, "status": "Online"}
                sys_data["meta_allocations"].append({"pair": sig.pair, "prob": float(sig.ai_confidence), "allocated": sig.pair in exec_orders, "kelly": float(exec_orders.get(sig.pair, 0.0))})
                sys_data["pair_stats"][sig.pair] = {"beta": float(sig.beta), "halfLife": int(sig.half_life), "trades": "Active" if sig.pair in exec_orders else "Watching"}
        
        # Send bulk state
        send_to_frontend({"ticker": ticker_data, "system": sys_data, "equity": {"t": now_iso, "balance": TOTAL_PORTFOLIO_VALUE}})

    logger.info("\t\t[MASTER] Loading LSTM Model...")
    device = torch.device("cpu")

    model = RegimeLSTM(input_size=5, hidden_size=32, num_classes=2).to(device)
    model.load_state_dict(torch.load(MASTER_MODEL_PATH, map_location=device))
    model.eval()

    with open(SCALER_PATH, 'rb') as f:
        scaler = pickle.load(f)

    logger.info("\t\t[MASTER] LSTM Model loaded successfully.")
    router = MT5Router(MT5_ACCOUNT, MT5_PASSWORD, MT5_SERVER)
    market_memory = {}

    while True:
        try:
            # 1. Wait for workers
            comm.barrier()
            signals = comm.gather(None, root=0)
            
            # 2. Update Memory
            for sig in signals:
                if sig is not None:
                    if sig.pair not in market_memory:
                        market_memory[sig.pair] = deque(maxlen=SEQUENCE_LENGTH)
                    
                    snapshot = [sig.z_score, sig.half_life, sig.variance, sig.beta, sig.spread]
                    market_memory[sig.pair].append(snapshot)

            is_warmed_up = all(len(dq) == SEQUENCE_LENGTH for dq in market_memory.values())

            if not is_warmed_up:
                current_bars = len(list(market_memory.values())[0]) if market_memory else 0
                logger.info(f"\t\t[MASTER] Master is warming up memory buffer... ({current_bars}/{SEQUENCE_LENGTH})")
                broadcast_ws(signals, status_override="WARMING")
                continue
            
            # 3. LSTM Inference
            trending_votes = 0
            trending_pairs = []

            for pair, memory_queue in market_memory.items():
                seq_array = np.array(memory_queue)
                features_only = seq_array[:, :5] 
                seq_scaled = scaler.transform(features_only)
                seq_tensor = torch.FloatTensor(seq_scaled).unsqueeze(0).to(device)
                
                with torch.no_grad():
                    output = model(seq_tensor)
                    _, predicted = torch.max(output.data, 1)
                    if predicted.item() == 1:
                        trending_votes += 1
                        trending_pairs.append(pair)

            # 4. Consensus Kill Switch
            num_pairs = len(market_memory)
            danger_ratio = trending_votes / num_pairs if num_pairs > 0 else 0
            is_global_danger = (danger_ratio > 0.33)
            
            if is_global_danger:
                logger.info(f"\t\t[MASTER] GLOBAL REGIME: TRENDING / UNSTABLE ({trending_votes}/{num_pairs} pairs)")
                logger.info(f"\t\t[MASTER] BLOCKING SIGNALS: Currently unstable: {', '.join(trending_pairs)}")
            else:
                logger.info(f"\t\t[MASTER] GLOBAL REGIME: MEAN-REVERTING (SAFE)")
            
            print("-" * 60)
            
            # 5. Kelly Allocation
            execution_orders = {}
            for sig in signals:
                if sig is not None:
                    status = "IGNORE"
                    if is_global_danger:
                        status = "BLOCKED BY LSTM"
                    elif sig.ai_confidence > 0.65:
                        allocation = calculate_kelly_size(sig.ai_confidence)
                        alloc_pct = allocation * 100 
                        status = f"APPROVED | RISK SIZE: {alloc_pct:.1f}%"
                        if allocation > 0:
                            execution_orders[sig.pair] = allocation
                    elif sig.ai_confidence > 0.40:
                        status = "WATCHING (Edge too low for Kelly)"
                        
                    logger.info(f"\t\t[MASTER] [{sig.pair}] Worker XGB: {sig.ai_confidence*100:05.2f}% | Z: {sig.z_score:5.2f} | {status}")
            
            # 6. Execute Trades
            if execution_orders:
                print("\nROUTING AI TRADES TO METATRADER 5:")
                for pair, pct_size in execution_orders.items():
                    capital_to_risk = TOTAL_PORTFOLIO_VALUE * pct_size
                    target_signal = next(sig for sig in signals if sig is not None and sig.pair == pair)
                    router.route_spread_trade(
                        pair_name=pair, 
                        total_dollar_risk=capital_to_risk, 
                        price_y=target_signal.price_y, 
                        price_x=target_signal.price_x, 
                        z_score=target_signal.z_score
                    )
            
            print("="*60)

            # 7. Safe Asynchronous WebSocket Push
            broadcast_ws(signals, danger_ratio=danger_ratio, exec_orders=execution_orders, is_danger=is_global_danger)

        except Exception as e:
            logger.error(f"\t[MASTER] Master loop error: {e}")
            break

if __name__ == "__main__":
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()

    if rank == 0:
        master_loop(comm)
    else:
        asyncio.run(async_worker_engine(comm, rank))