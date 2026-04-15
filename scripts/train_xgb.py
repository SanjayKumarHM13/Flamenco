from config import TRAINING_DATA_PATH
import os
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt

def train_worker_model():
    data_path = TRAINING_DATA_PATH

    if not os.path.exists(data_path):
        return

    df = pd.read_csv(data_path)

    features = [
        'z_score',
        'half_life',
        'kalman_variance',
        'beta',
        'spread'
        'p_value'
    ]

    X = df[features]
    y = df['target']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

    positive_cases = y_train.sum()
    negative_cases = len(y_train) - positive_cases
    scale_weight = negative_cases / positive_cases if positive_cases > 0 else 1.0
