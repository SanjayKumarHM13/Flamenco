from signals.ou import OrnsteinUhlenbeck
import os
import csv
from statistics import variance
import requests
import logging
from config import SYMBOLS, DEFAULT_HALF_LIFE, KALMAN_Q, KALMAN_R, KELLY_FRACTION
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

    logger.info(f"\t[Rank: {rank}] My symbols: {my_symbol}")

    if len(my_symbol) != 2:
        logger.info(f"\tRank {rank} idling: Needs exactly 2 symbols to form a pair.")
        return

    symbol_y, symbol_x = my_symbol[0], my_symbol[1]
    pair_name = f"{symbol_y}/{symbol_x}"

    # Initializing Kalman Filter
    logger.info(f"\t[Rank: {rank}] Initializing Kalman Filter for {pair_name}")
    kf = PairKalmanFilter(rank=rank, pair_name=pair_name, q_variance=KALMAN_Q, r_variance=KALMAN_R)
    logger.info(f"\t[Rank: {rank}] Initializing Ornstein-Uhlenbeck for {pair_name}")
    ou = OrnsteinUhlenbeck(window_size=60)

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

    logger.info(f"\t[Rank: {rank}] monitoring Pair: {pair_name}")

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

            logger.info(f"\t[Rank: {rank}] [{pair_name}] Beta updated: {posterior_beta:.4f}")
            
            # Calculate the current spread: Y - βX
            current_spread = price_y - (posterior_beta * price_x)

            # updating the Ornstein-Uhlenbeck Process
            z_score, half_life, p_value = ou.update(current_spread)
            logger.info(f"\t[Rank: {rank}] [{pair_name}] Z: {z_score:.2f} | HL: {half_life:.1f} | b: {posterior_beta:.4f}")
            
            with open(csv_file, mode='a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    timestamp, pair_name,
                    round(z_score, 2), round(half_life, 2), round(p_value, 2),
                    round(variance, 4), round(posterior_beta, 4),
                    round(current_spread, 4), round(price_y, 4), round(price_x, 4)
                ])
            
            # --- CREATE SIGNAL ---
            my_signal = TradeSignal(
                rank=rank,
                pair=pair_name,
                z=z_score,    
                signal=1,     # Placeholder 
                beta=posterior_beta,
                spread=current_spread,
                half_life=DEFAULT_HALF_LIFE,
                xgb_prob=0.88, # Placeholder       
                kelly_size=KELLY_FRACTION
            )
            
            # Sync the cluster and send to master
            comm.barrier()
            comm.gather(my_signal, root=0)