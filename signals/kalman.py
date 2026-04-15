from statistics import covariance
from statistics import mode
from genericpath import exists
import os
import csv # In future use TimestampDB
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PairKalmanFilter:
    def __init__(self, rank, pair_name, q_variance, r_variance):
        self.rank = rank
        self.pair_name = pair_name
        self.Q = q_variance
        self.R = r_variance

        # State Variables
        self.beta = 0.0             # Current extimate of the hedge ration
        self.P = 0.0                # Variance of the extiamte
        self.is_initialized = False

        # Setting up local CSV
        self.log_file = f"logs/worker_{self.rank}_kalman.csv"
        self._init_logger()

    def _init_logger(self):
        os.makedirs("logs", exist_ok=True)
        if not os.path.exists(self.log_file):
            with open(self.log_file, mode="w", newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["timestamp", "pair", "price_y", "price_x", "prior_beta", "posterior_beta", "variance"])
    
    def initialize_ols(self, price_x_history, price_y_history):
        """
        Initializes the filter using an Ordinary Least Squares (OLS) 
        estimate over the last 60 bars.
        """

        y = np.array(price_y_history)
        x = np.array(price_x_history)

        # Calculate OLS beta: Cov(X, Y) / Var(X)
        covariance_matrix = np.cov(x, y)
        self.beta = covariance_matrix[0, 1] / covariance_matrix[0, 0]

        # Initailize the uncertainity (p) slightly higher than 0 to allow initial adaptation
        self.P = 1.0
        self.is_initialized = True

        logger.info(f"\t[Rank: {self.rank}] Kalman Filter [{self.pair_name}] initialized with OLS Beta: {self.beta:.4f}")

    def update(self, price_x, price_y, timestamp):
        """
        Updates the filter with a new bar close and returns the posterior beta.
        Y is the dependent variable, X is the independent variable (Y = βX).
        """
        if not self.is_initialized:
            raise RuntimeError(f"[Rank: {self.rank}] Kalman Filter for {self.pair_name} not initialized.")
        
        # 1. PREDICTION STEP
        # The model assumes the hedge ratio is constant (no drift)
        prior_beta = self.beta

        # beta_{t|t-1} = beta_{t-1|t-1} (We assume beta behaves like a random walk)
        prior_p = self.P + self.Q

        # 2. UPDATE STEP
        # Calculate the residual (error) for this new bar
        # We expect Y_hat = beta * X
        residual = price_y - (prior_beta * price_x)

        # Calculate the variance of the measurement
        measurement_variance = (price_x ** 2) * prior_p + self.R

        # Calculate the innovation (measurement uncertainty)
        # This is the variance of the residual
        ## innovation_variance = prior_p + self.R

        # Calculate the Kalman Gain (how much we trust the new data)
        ## kalman_gain = prior_p / measurement_variance
        kalman_gain = (prior_p * price_x) / measurement_variance

        # Update the Hedge Ratio
        self.beta = prior_beta + (kalman_gain * residual)

        # Update the Uncertainty
        ## self.P = (1 - kalman_gain) * prior_p
        self.P = prior_p - (kalman_gain * price_x * prior_p)

        # 3. LOGGING
        self._log_update(timestamp, price_y, price_x, prior_beta)

        return self.beta, self.P

    def _log_update(self, timestamp, price_y, price_x, prior_beta):
        """Appends the update to the local CSV log."""
        try:
            with open(self.log_file, mode="a", newline='') as f:
                writer = csv.writer(f)
                writer.writerow([timestamp, self.pair_name, price_y, price_x, round(prior_beta, 6), round(self.beta, 6), round(self.P, 6)])
        except Exception as e:
            print(f"[Rank: {self.rank}] Kalman Log Error [{self.pair_name}]: {e}")
