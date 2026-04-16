from signals.ou import OrnsteinUhlenbeck
import os
import csv
from statistics import variance
import requests
import logging
import pandas as pd
import xgboost as xgb
import numpy as np

from config import SYMBOLS, DEFAULT_HALF_LIFE, KALMAN_Q, KALMAN_R, KELLY_FRACTION, MODEL_PATH
from data.streamer import stream_closed_bars
from signals.kalman import PairKalmanFilter
from mpi.comms import TradeSignal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _init_logger(log_file):
    os.makedirs("logs", exist_ok=True)
    if not os.path.exists(log_file):
        with open(log_file, mode="w", newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "pair", "z_score", "half_life", "p_value", "kalman_variance", "beta", "spread", "price_y", "price_x"])

def get_recent_closes(symbol, limit=60, interval="5m"):
    """Fetches the last N closed candles to initialize the filter."""
    url = "https://data-api.binance.vision/api/v3/klines"
    params = {
        "symbol": symbol.upper(),
        "interval": interval,
        "limit": limit
    }
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    
    # The close price is at index 4 in the Binance kline payload
    return [float(candle[4]) for candle in data]

async def async_worker_engine(comm, rank):
    size = comm.Get_size()
    workers_size = size - 1 # Rank 0 is master
    worker_index = rank - 1

    if workers_size <= 0:
        print("ERROR: Not enough processors.")
        return

    # Pairing i th and i+2 th symbols.
    # In futute, engle-granger test will be used to find pairs.
    my_symbol = SYMBOLS[worker_index*2 : (worker_index*2)+2]

    logger.info(f"\t[RANK {rank}] My symbols: {my_symbol}")

    if len(my_symbol) != 2:
        logger.info(f"\tRank {rank} idling: Needs exactly 2 symbols to form a pair.")
        return

    symbol_y, symbol_x = my_symbol[0], my_symbol[1]
    pair_name = f"{symbol_y}/{symbol_x}"

    # Initializing Kalman Filter
    logger.info(f"\t[RANK {rank}] Initializing Kalman Filter for {pair_name}")
    kf = PairKalmanFilter(rank=rank, pair_name=pair_name, q_variance=KALMAN_Q, r_variance=KALMAN_R)
    logger.info(f"\t[RANK {rank}] Initializing Ornstein-Uhlenbeck for {pair_name}")
    ou = OrnsteinUhlenbeck(window_size=60)
    logger.info(f"\t[RANK {rank}] Loading XGBoost Model")
    ai_model = xgb.XGBClassifier()

    model_loaded = False
    try:
        ai_model.load_model(MODEL_PATH)
        model_loaded = True
        logger.info(f"\t[RANK {rank}] AI Model loaded successfully.")
    except Exception as e:
        logger.error(f"\t[RANK {rank}] CRITICAL: Failed to load AI model: {e}")

    try:
        price_y_hist = get_recent_closes(symbol_y, limit=60)
        price_x_hist = get_recent_closes(symbol_x, limit=60)
        kf.initialize_ols(price_y_history=price_y_hist, price_x_history=price_x_hist)

        historical_spreads = [y - (kf.beta * x) for y, x in zip(price_y_hist, price_x_hist)]
        ou.warmup(historical_spreads)

    except Exception as e:
        print(f"CRITICAL: Rank {rank} failed to warm up: {e}")
        return # Kill this worker if it can't initialize

    csv_file = f"logs/worker_{rank}_features.csv"
    _init_logger(csv_file)

    current_bar_prices = {}

    logger.info(f"\t[RANK {rank}] monitoring Pair: {pair_name}")

    # This loop will now only trigger exactly once every 5 minutes per symbol!
    async for closed_bar in stream_closed_bars(rank, my_symbol):
        symbol = closed_bar['symbol']
        current_bar_prices[symbol] = closed_bar['close']

        if symbol_y in current_bar_prices and symbol_x in current_bar_prices:
            price_y = current_bar_prices[symbol_y]
            price_x = current_bar_prices[symbol_x]
            timestamp = closed_bar['timestamp']

            # Updating the Kalman Filter
            posterior_beta, variance = kf.update(price_y, price_x, timestamp)
            logger.info(f"\t[RANK {rank}] [{pair_name}] Beta updated: {posterior_beta:.4f}")
            # Calculate the current spread: Y - βX
            current_spread = price_y - (posterior_beta * price_x)

            # updating the Ornstein-Uhlenbeck Process
            z_score, half_life, p_value = ou.update(current_spread)
            logger.info(f"\t[RANK {rank}] [{pair_name}] Z: {z_score:.2f} | HL: {half_life:.1f} | b: {posterior_beta:.4f}")

            live_feature = pd.DataFrame([{
                'z_score': z_score,
                'half_life': half_life,
                'kalman_variance': variance,
                'beta': posterior_beta,
                'spread': current_spread,
                'p_value': p_value
            }])

            xgb_prob = 0.5 # Default if model fails
            if model_loaded:
                try:
                    xgb_prob = ai_model.predict_proba(live_feature)[0][1]
                    logger.info(f"\t[RANK {rank}] [{pair_name}] Z: {z_score:.2f} | HL: {half_life:.1f} | AI Confidence: {xgb_prob*100:.1f}%")
                except Exception as e:
                    logger.error(f"\t[RANK {rank}] Prediction error: {e}")
            
            
            with open(csv_file, mode='a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    timestamp, pair_name,
                    round(z_score, 2), round(half_life, 2), round(p_value, 2),
                    round(variance, 4), round(posterior_beta, 4),
                    round(current_spread, 4), round(price_y, 4), round(price_x, 4)
                ])

            # --- CREATE SIGNAL ---
            signal = TradeSignal(
                rank=rank,
                pair=pair_name,
                z_score=round(z_score, 3),
                beta=round(posterior_beta, 4),
                variance=round(variance, 6),
                spread=current_spread,
                half_life=DEFAULT_HALF_LIFE,
                ai_confidence=float(xgb_prob),
                kelly_size=KELLY_FRACTION,
                price_y=float(price_y),
                price_x=float(price_x),
                timestamp=timestamp
            )
            
            # Sync the cluster and send to master
            comm.barrier()
            comm.gather(signal, root=0)