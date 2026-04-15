import numpy as np
from collections import deque
from statsmodels.tsa.stattools import adfuller

from config import OU_WINDOW_SIZE

class OrnsteinUhlenbeck:
    def __init__(self, window_size=OU_WINDOW_SIZE):
        self.window_size = window_size
        self.spreads = deque(maxlen=window_size)

    def warmup(self, historical_spreads):
        for s in historical_spreads:
            self.spreads.append(s)
    
    def update(self, current_spread):
        """
        Calculates the Z-Score and Half-Life for the current spread.
        Applies gates for ADF p-value and Half-Life range.
        Returns: (z_score, half_life)
        """
        self.spreads.append(current_spread)
        
        if len(self.spreads) < 30:
            return 0.0, 0.0, 1.0

        S = np.array(self.spreads)

        try:
            # Using autolag='AIC' for efficiency, and regression='c' (constant only)
            adf_res = adfuller(S, regression='c', autolag='AIC')
            p_value = adf_res[1]
        except:
            p_value = 1.0


        # 2. Fit OU params via OLS on Delta S ~ S_lag
        delta_S = S[1:] - S[:-1]
        s_lag = S[:-1]
        b, a = np.polyfit(s_lag, delta_S, 1)
        
        if b >= 0:
            half_life = 999.0
            mu = np.mean(S)
        else:
            theta = -b
            half_life = np.log(2) / theta
            mu = -a / b

        # Calculating the Z-Score
        sigma = np.std(S)
        if sigma == 0:
            z_score = 0.0
        else:
            z_score = (current_spread - mu) / sigma
        
        return z_score, half_life, p_value
