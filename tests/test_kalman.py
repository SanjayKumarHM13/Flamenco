import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import pandas as pd
import numpy as np
from signals.kalman import PairKalmanFilter

def simulate_kalman():
    print("Starting Kalman Filter Offline Test...")
    
    # 1. Create synthetic price data (100 bars)
    # Asset X is a random walk. Asset Y is exactly 2.5 * X + some noise.
    # Therefore, the true Hedge Ratio (Beta) is 2.5.
    np.random.seed(42)
    price_x = np.cumsum(np.random.normal(0, 1, 100)) + 100 
    price_y = (price_x * 2.5) + np.random.normal(0, 2, 100) 
    
    # 2. Initialize the Filter
    kf = PairKalmanFilter(rank=99, pair_name="TEST/PAIR", q_variance=1e-4, r_variance=1.0)
    
    # Simulate the initial OLS training on the first 60 bars
    kf.initialize_ols(price_y[:60], price_x[:60])
    
    # 3. Simulate live updates on the remaining 40 bars
    print("\nSimulating live updates...")
    for i in range(60, 100):
        # Simulate a Binance millisecond timestamp
        fake_timestamp = int(time.time() * 1000) + (i * 60000) 
        
        beta, variance = kf.update(price_y[i], price_x[i], fake_timestamp)
        print(f"Bar {i}: New Beta = {beta:.4f}")
        
    # 4. Verify the CSV
    log_path = "logs/worker_99_kalman.csv"
    if os.path.exists(log_path):
        print(f"\nSUCCESS: Log file created at {log_path}")
        df = pd.read_csv(log_path)
        print("\nLast 5 rows of CSV:")
        print(df.tail(5))
    else:
        print("\nERROR: Log file was not created!")

if __name__ == "__main__":
    simulate_kalman()