import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts import load_data
from config import TRAINING_DATA_PATH, MODEL_PATH

import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt

def train_worker_model():
    load_data.generate_training_labels()
    print("Loading labeled data...")
    data_path = TRAINING_DATA_PATH

    if not os.path.exists(data_path):
        print(f"Error: Could not find {data_path}. Run label_data.py first!")
        return

    df = pd.read_csv(data_path)

    features = [
        'z_score',
        'half_life',
        'kalman_variance',
        'beta',
        'spread',
        'p_value'
    ]

    X = df[features]
    y = df['target']

    print(f"Training on {len(X)} samples using features: {features}")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

    positive_cases = y_train.sum()
    negative_cases = len(y_train) - positive_cases
    scale_weight = negative_cases / positive_cases if positive_cases > 0 else 1.0

    print("Training XGBoost Classifier...")
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        scale_pos_weight=scale_weight,
        random_state=42,
        n_jobs=-1
    )

    model.fit(X_train, y_train)

    print("="*40)
    print("AI PERFORMANCE REPORT")
    print("="*40)

    y_pred = model.predict(X_test)
    
    print(classification_report(y_test, y_pred, labels=[0, 1], target_names=["Loss/Ignore (0)", "Win (1)"], zero_division=0))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    print("\nPloting Feature Importance")
    xgb.plot_importance(model, importance_type='gain', title='What drives the AI desicion?')
    plt.tight_layout()
    plt.savefig("data/training/feature_importance.png")
    print("Saved feature importance chart to data/training/feature_importance.png")

    os.makedirs("models", exist_ok=True)
    model.save_model(MODEL_PATH)

if __name__ == "__main__":
    train_worker_model()
