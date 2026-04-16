from mpi4py import MPI
import asyncio
from collections import deque
import logging
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

def master_loop(comm):
    logger.info("\t\t[MASTER] Master node initialized. Waiting for signals...")

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

    while True:
        try:
            comm.barrier()

            signals = comm.gather(None, root=0)
            
            for sig in signals:
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

            # Check if Memory is Full (Ready for AI)
            # The Master cannot predict the regime until it has 60 full bars
            is_warmed_up = all(len(dq) == SEQUENCE_LENGTH for dq in market_memory.values())

            if not is_warmed_up:
                current_bars = len(list(market_memory.values())[0]) if market_memory else 0
                logger.info(f"\t\t[MASTER] Master is warming up memory buffer... ({current_bars/SEQUENCE_LENGTH})")
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
            
            # ==========================================
            # FIRE THE ORDERS VIA MT5
            # ==========================================
            if execution_orders:
                print("\nROUTING AI TRADES TO METATRADER 5:")
                for pair, pct_size in execution_orders.items():
                    
                    # 1. Calculate real dollar value based on Kelly percentage
                    capital_to_risk = TOTAL_PORTFOLIO_VALUE * pct_size
                    
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