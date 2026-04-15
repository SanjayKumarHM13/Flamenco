import os

# ==========================================
# NETWORK & DATA INGESTION
# ==========================================
# For Ticker Data
BINANCE_WS_BASE_URL="wss://stream.binance.com:9443/ws"
KLINE_INTERVAL="1m"

# For Historical Data - For the engle-granger.
BINANCE_REST_API_BASE_URL="https://data-api.binance.vision/api/w3/klines"
HIST_DAYS=30
HIST_INTERVAL="5m"

# ==========================================
# TRADING SYMBOLS
# ==========================================
# Add as many pairs as you want here. 
# The engine will automatically distribute them across available CPU cores.
SYMBOLS=[
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "DOGEUSDT",
    "ADAUSDT",
    "AVAXUSDT",
    "DOTUSDT",
    "MATICUSDT"
]

# ==========================================
# QUANTITATIVE STRATEGY PARAMETERS
# ==========================================

# Default fallback values before the AI models warm up
DEFAULT_HALF_LIFE=45
DEFAULT_BETA=1.0

# Execution Thresholds
Z_SCORE_ENTRY_THRESHOLD=2.0
Z_SCORE_EXIT_THRESHOLD=0.5
MIN_XGB_PROBABILITY=0.65

# Risk Management
KELLY_FRACTION=0.25 # Not less than 25% of Kelly size
GLOBAL_CIRCUIT_BREAKER=0.05 # Stop trading when the portfolio drops 5% in a day

# ==========================================
# KALMAN FILTER PARAMETERS
# ==========================================
# Q: How fast the true hedge ratio is allowed to drift. 
# Higher = beta adapts faster. Lower = beta is more stable.
KALMAN_Q=1e-4

# R: How noisy the market observations are. 
# Higher = trusts the previous beta more. Lower = trusts the new price jump more.
KALMAN_R=1.0

OU_WINDOW_SIZE=60

#
 
LOOK_AHEAD_BARS=12

#

TRAINING_DATA_PATH="data/training/labeled_training_data.csv"