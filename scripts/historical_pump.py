import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import pandas as pd
import numpy as np
import time
import os
import csv
from datetime import datetime

# Import your math models
from signals.kalman import PairKalmanFilter
from signals.ou import OrnsteinUhlenbeck

def _init_logger(log_file):
    os.makedirs("logs", exist_ok=True)
    if not os.path.exists(log_file):
        with open(log_file, mode="w", newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "pair", "z_score", "half_life", "p_value", "kalman_variance", "beta", "spread", "price_y", "price_x"])


def get_historical_klines(symbol, interval="1m", days_back=200):
    """
    Fetches historical candlestick closes from Binance.
    Binance limits each request to 1000 bars, so we must paginate backwards.
    """
    print(f"Fetching {days_back} days of {interval} data for {symbol}...")
    
    # 5m candles = 12 per hour * 24 = 288 per day
    total_bars_needed = days_back * 288
    
    url = "https://data-api.binance.vision/api/v3/klines"
    all_closes = []
    all_timestamps = []
    
    # Calculate the end time (now) in milliseconds
    end_time = int(time.time() * 1000)
    
    while len(all_closes) < total_bars_needed:
        params = {
            "symbol": symbol.upper(),
            "interval": interval,
            "limit": 1000,
            "endTime": end_time
        }
        
        response = requests.get(url, params=params)
        
        if response.status_code != 200:
            print(f"Error fetching data for {symbol}: {response.text}")
            break
            
        data = response.json()
        
        if not data:
            break
            
        # Parse the data (index 0 is open time, index 4 is close price)
        # We insert at the beginning because we are reading backwards in time
        batch_closes = [float(candle[4]) for candle in data]
        batch_times = [int(candle[0]) for candle in data]
        
        all_closes = batch_closes + all_closes
        all_timestamps = batch_times + all_timestamps
        
        # Set the next end_time to just before the oldest bar we just fetched
        end_time = data[0][0] - 1
        
        # Be nice to the Binance API rate limits
        time.sleep(0.1)
        
    print(f"Fetched {len(all_closes)} bars for {symbol}.")
    return all_timestamps[-total_bars_needed:], all_closes[-total_bars_needed:]

from config import SYMBOLS
from mpi4py import MPI

def run_mpi_historical_pumps():
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()
    
    pairs = []
    for i in range(0, len(SYMBOLS), 2):
        if i + 1 < len(SYMBOLS):
            pairs.append(f"{SYMBOLS[i]}/{SYMBOLS[i+1]}")
            
    # Assign pairs to this rank using round-robin distribution
    my_pairs = [pairs[i] for i in range(len(pairs)) if i % size == rank]
    
    my_temp_files = []
    for pair_name in my_pairs:
        print(f"\n[RANK {rank}] Processing Pair: {pair_name}")
        temp_csv = f"logs/temp_worker_{rank}_{pair_name.replace('/', '_')}.csv"
        if os.path.exists(temp_csv):
            os.remove(temp_csv)
            
        run_historical_simulation(pair_name, target_csv=temp_csv)
        my_temp_files.append(temp_csv)

    # Synchronize all processes
    comm.barrier()
    all_temp_files = comm.gather(my_temp_files, root=0)

    # Rank 0 consolidates the final CSV
    if rank == 0:
        csv_file = "logs/worker_all_pairs.csv"
        if os.path.exists(csv_file):
            os.remove(csv_file)
            
        _init_logger(csv_file)
        
        print("\n[RANK 0] Consolidating worker data into final CSV...")
        with open(csv_file, 'a', newline='') as outfile:
            writer = csv.writer(outfile)
            
            for temp_list in all_temp_files:
                for temp_file in temp_list:
                    if os.path.exists(temp_file):
                        with open(temp_file, 'r') as infile:
                            reader = csv.reader(infile)
                            for row in reader:
                                writer.writerow(row)
                        os.remove(temp_file)
                        
        print(f"[RANK 0] Simulation Complete! Consolidated data into {csv_file}")

def run_historical_simulation(pair_name, target_csv):
    print("="*50)
    print(f" Starting Historical Pump for {pair_name}")
    print("="*50)
    
    symbol_y, symbol_x = pair_name.split("/")
    
    # 1. Fetch 30 days of data (approx 8,640 bars)
    times_y, closes_y = get_historical_klines(symbol_y)
    times_x, closes_x = get_historical_klines(symbol_x)

    if len(closes_y) < 60 or len(closes_x) < 60:
        print(f"Error: Not enough data for {pair_name}. Skipping.")
        return
    
    min_len = min(len(closes_y), len(closes_x))
    closes_y = closes_y[-min_len:]
    closes_x = closes_x[-min_len:]
    times = times_y[-min_len:]
    
    # 2. Setup the Math Engine
    kf = PairKalmanFilter(rank=99, pair_name=pair_name, q_variance=1e-4, r_variance=1.0)
    ou = OrnsteinUhlenbeck(window_size=60)
    
    # 3. Baseline Warmup
    price_y_warmup = closes_y[:60]
    price_x_warmup = closes_x[:60]
    kf.initialize_ols(price_y_warmup, price_x_warmup)
    
    historical_spreads = [y - (kf.beta * x) for y, x in zip(price_y_warmup, price_x_warmup)]
    ou.warmup(historical_spreads)
    
    rows_written = 0
    
    # 4. Simulation Loop
    for i in range(60, len(closes_y)):
        py = closes_y[i]
        px = closes_x[i]
        ts = times[i]
        
        posterior_beta, variance = kf.update(py, px, ts)
        current_spread = py - (posterior_beta * px)
        z_score, half_life, p_value = ou.update(current_spread)
        
        with open(target_csv, mode='a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                ts, pair_name, 
                round(z_score, 4), round(half_life, 2), round(p_value, 2),
                round(variance, 6), round(posterior_beta, 6), 
                round(current_spread, 4), py, px
            ])
            rows_written += 1
            
    print(f"Pair {pair_name} Complete! Generated {rows_written} feature rows.")

if __name__ == "__main__":
    run_mpi_historical_pumps()