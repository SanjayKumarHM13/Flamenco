import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import MASTER_MODEL_PATH, SCALER_PATH
from config import EPOCHS
from config import NUM_CLASSES
from config import HIDDEN_SIZE
from config import INPUT_FEATURES
from config import SEQUENCE_LENGTH

import torch
import torch.nn as nn
import pandas as pd
import numpy as np
import logging
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==========================================
# 1. The PyTorch LSTM Architecture
# ==========================================
class RegimeLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_classes):
        super(RegimeLSTM, self).__init__()
        self.hidden_size = hidden_size

        # LSTM Layer
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers=2, batch_first=True)

        # Output Layer
        self.fc = nn.Linear(hidden_size, num_classes)

    def forward(self, x):
        # Initialize hidden state and cell state
        h0 = torch.zeros(2, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(2, x.size(0), self.hidden_size).to(x.device)

        # Forward propagate LSTM
        out, _ = self.lstm(x, (h0, c0))

        # Decode the hidden state of the last time step
        out = self.fc(out[:, -1, :])
        return out

# ==========================================
# 2. Data Preparation & Labeling
# ==========================================
class SequenceDataSet(Dataset):
    def __init__(self, csv_path, seq_length):
        logger.info("Loading data from LSTM")
        df = pd.read_csv(csv_path)

        features = ['z_score', 'half_life', 'kalman_variance', 'beta', 'spread']

        self.scaler = StandardScaler()
        data_scaled = self.scaler.fit_transform(df[features].values)

        self.X = []
        self.y = []

        logger.info("Slicing data into 60-bar sequences and generating Regime labels...")
        for i in range(len(data_scaled) - seq_length):
            seq = data_scaled[i : i +seq_length] # getting the 60-bar sequence
            
            # --- AUTO-LABELING THE REGIME ---
            # We look at the Z-scores inside this 60-bar window.
            # If the spread is stuck out of bounds (trending/crashing), label = 1.
            # Otherwise, it is mean-reverting, label = 0.
            z_scores_in_window = df['z_score'].values[i : i + seq_length]
            mean_abs_z = np.mean(np.abs(z_scores_in_window))
            max_abs_z = np.max(np.abs(z_scores_in_window))

            # Simple rule: If the average Z-score over the last 5 hours is > 1.5, 
            # it means it's not crossing 0. It is trending.
            if mean_abs_z > 1.5 and max_abs_z > 2.5:
                regime = 1 # TRENDING (Danger)
            else:
                regime = 0 # MEAN_REVERTING (Safe to trade)

            self.X.append(seq)
            self.y.append(regime)

        self.X = torch.FloatTensor(np.array(self.X))
        self.y = torch.LongTensor(np.array(self.y))

        logger.info(f"Created {len(self.X)} sequences.")
        print(f"Regime 0 (Safe): {sum(self.y.numpy() == 0)} | Regime 1 (Danger): {sum(self.y.numpy() == 1)}")

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]


# ==========================================
# 3. The Training Loop
# ==========================================
def train_model():
    csv_file = "logs/worker_99_features.csv"
    if not os.path.exists(csv_file):
        logger.error("ERROR: Could not locate the CSV file. Run python scripts hitorical_pump.py first.")
        return
    
    dataset = SequenceDataSet(csv_file, seq_length=SEQUENCE_LENGTH)
    dataloader = DataLoader(dataset, batch_size=32, shuffle=True)

    model = RegimeLSTM(INPUT_FEATURES, HIDDEN_SIZE, NUM_CLASSES)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    logger.info("Starting Training...")
    for epoch in range(EPOCHS):
        epoch_loss = 0
        correct = 0
        total = 0

        for batch_X, batch_y in dataloader:
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()

            # Track accuracy
            _, predicted = torch.max(outputs.data, 1)
            total += batch_y.size(0)
            correct += (predicted == batch_y).sum().item()
        
        acc = 100 * correct / total
        logger.info(f"Epoch [{epoch+1}/{EPOCHS}] | Loss: {epoch_loss/len(dataloader):.4f} | Accuracy: {acc:.2f}%")

    # Save the model
    os.makedirs("models", exist_ok=True)
    torch.save(model.state_dict(), MASTER_MODEL_PATH)

    import pickle
    with open(SCALER_PATH, 'wb') as f:
        pickle.dump(dataset.scaler, f)

    logger.info(f"Model saved to {MASTER_MODEL_PATH}")

if __name__ == "__main__":
    train_model()