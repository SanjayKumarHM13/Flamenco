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

def run_historical_simulation(pair_name):
    print("="*50)
    print(f" Starting Historical Pump for {pair_name}")
    print("="*50)
    
    symbol_y, symbol_x = pair_name.split("/")
    
    # 1. Fetch 30 days of data (approx 8,640 bars)
    times_y, closes_y = get_historical_klines(symbol_y)
    times_x, closes_x = get_historical_klines(symbol_x)

    if len(closes_y) < 60 or len(closes_x) < 60:
        print("Error: Not enough data fetched. Exiting.")
        return
    
    # Ensure the arrays are the exact same length (aligning timestamps)
    # If one coin listed later than another, this prevents a crash.
    min_len = min(len(closes_y), len(closes_x))
    closes_y = closes_y[-min_len:]
    closes_x = closes_x[-min_len:]
    times = times_y[-min_len:] # Assume timestamps match closely enough for 5m bars
    
    # 2. Setup the Math Engine
    # We use rank=99 so it doesn't overwrite a live worker's log if you are running it
    kf = PairKalmanFilter(rank=99, pair_name=pair_name, q_variance=1e-4, r_variance=1.0)
    ou = OrnsteinUhlenbeck(window_size=60)
    
    # 3. Setup the Output CSV
    os.makedirs("logs", exist_ok=True)
    csv_file = f"logs/worker_99_features.csv"
    
    # Write the header
    _init_logger(csv_file)
        
    print("\nPumping data through Kalman & OU Models. This may take a minute...")
    
    # 4. The Simulation Loop
    # We need the first 60 bars just to "warm up" the OLS baseline
    price_y_warmup = closes_y[:60]
    price_x_warmup = closes_x[:60]
    kf.initialize_ols(price_y_warmup, price_x_warmup)
    
    # Warmup OU
    historical_spreads = [y - (kf.beta * x) for y, x in zip(price_y_warmup, price_x_warmup)]
    ou.warmup(historical_spreads)
    
    rows_written = 0
    
    # Now loop through the remaining 8,500+ bars as if it were a live WebSocket feed
    for i in range(60, len(closes_y)):
        py = closes_y[i]
        px = closes_x[i]
        ts = times[i]
        
        # Step A: Update Kalman
        posterior_beta, variance = kf.update(py, px, ts)
        current_spread = py - (posterior_beta * px)
        
        # Step B: Update OU (Add ADF and is_hl_valid if you implemented them)
        z_score, half_life, p_value = ou.update(current_spread)
        
        # Step C: Save to CSV
        with open(csv_file, mode='a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                ts, pair_name, 
                round(z_score, 4), round(half_life, 2), round(p_value, 2),
                round(variance, 6), round(posterior_beta, 6), 
                round(current_spread, 4), py, px
            ])
            rows_written += 1
            
    print(f"Simulation Complete! Generated {rows_written} feature rows.")
    print(f"Data saved to: {csv_file}")

if __name__ == "__main__":
    # Test it with one pair first
    run_historical_simulation("BTCUSDT/ETHUSDT")