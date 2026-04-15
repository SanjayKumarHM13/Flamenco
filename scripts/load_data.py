from config import LOOK_AHEAD_BARS
import os
import glob
import pandas as pd
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_training_labels():
    logger.info("\tStrating AI Feature Labeling!")

    # loading the csv into one massive dataframe
    csv_files = glob.glob("logs/worker_*_features.csv")
    if not csv_files:
        return
    
    df_list = [pd.read_csv(f) for f in csv_files]
    df = pd.concat(df_list, ignore_index=True)

    # Sorting by pairs and time
    df = df.sort_values(by=['pair', 'timestamp']).reset_index(drop=True)

    # Defining the "target" 
    df['target'] = 0

    for i in range(1, LOOK_AHEAD_BARS + 1):
        future_z = df.groupby('pair')['z_score'].shift(-i)

        # Condition A: Spread is currently undervalued (Z < 0) and it crosses UP to 0
        long_success = (df['z_score'] < 0) & (future_z >= 0.0)

        # Condition B: Spread is currently overvalued (Z > 0) and it crosses DOWN to 0
        short_success = (df['z_score'] > 0) & (future_z <= 0.0)

        # If either condition is met at ANY point in the next 12 bars, mark this row as a WIN (1)
        df.loc[long_success | short_success, 'target'] = 1

    # CLEANUP AND EXPORT
    # The last 12 bars of every pair cannot be labeled because we don't know the future yet.
    # We must drop these so we don't train the AI on false zeroes.
    def derp_tail(group):
        return group.iloc[:-LOOK_AHEAD_BARS]
    
    df = df.groupby('pair', group_keys=False).apply(derp_tail)

    df_filtered = df[df['z_score'].abs() >= 1.0].copy()

    os.makedirs("data/training", exist_ok=True)
    output_path = "data/training/labeled_training_data.csv"
    df_filtered.to_csv(output_path, index=False)
    logger.info(f"\t[AI Feature Labeling] Saved {len(df_filtered)} samples to {output_path}")