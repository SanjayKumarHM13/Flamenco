import os
import dotenv
dotenv.load_dotenv()

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
SYMBOLS = [
    # Worker 0 (Index 0, 1): The Market Leaders
    # Highest macro correlation in the market.
    "BTCUSDT", 
    "ETHUSDT",
    
    # Worker 1 (Index 2, 3): The High-Speed Alt-L1s
    # Direct competitors; they share the same narrative and institutional capital flows.
    "SOLUSDT", 
    "AVAXUSDT",
    
    # Worker 3 (Index 6, 7): The Utility/Ecosystem Tokens
    # Binance's native coin and Polygon's scaling token; both heavily tied to network activity.
    "BNBUSDT", 
    "MATICUSDT",

    # Worker 2 (Index 4, 5): The Academic/Legacy L1s
    # Older generation, research-heavy protocols that often move in tandem.
    "ADAUSDT", 
    "DOTUSDT",
    
    # Worker 4 (Index 8, 9): The Retail Darlings
    # The weakest structural pair in this list, but both are highly liquid assets 
    # heavily driven by retail sentiment and payment narratives.
    "XRPUSDT", 
    "DOGEUSDT"
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
KALMAN_Q=1e-5
# R: How noisy the market observations are. 
# Higher = trusts the previous beta more. Lower = trusts the new price jump more.
KALMAN_R=1.0

# ==========================================
# Ornstein-Uhlenbeck PARAMETERS
# ==========================================
OU_WINDOW_SIZE=60

# ==========================================
# AI DATA TRAINING PARAMETERS
# ========================================== 
LOOK_AHEAD_BARS=12
TRAINING_DATA_PATH="data/training/labeled_training_data.csv"

# ==========================================
# AI DATA MODELING PARAMETERS
# ========================================== 
MODEL_PATH="models/xgb_model.json"
MASTER_MODEL_PATH="models/master_lstm_v1.pth"
SCALER_PATH="models/scaler.pkl"

# ==========================================
# HYPERPARAMETERS
# ========================================== 
SEQUENCE_LENGTH=30
INPUT_FEATURES=5
HIDDEN_SIZE=32
NUM_CLASSES=2
EPOCHS=10

# ==========================================
# MT5 CREDENTIALS
# ========================================== 
MT5_ACCOUNT = os.getenv("MT5_ACCOUNT")
MT5_PASSWORD = os.getenv("MT5_PASSWORD")
MT5_SERVER = os.getenv("MT5_SERVER")
TOTAL_PORTFOLIO_VALUE = 100000
