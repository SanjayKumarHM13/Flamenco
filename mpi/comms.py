from dataclasses import dataclass, field
import time

@dataclass
class TradeSignal:
    rank: int
    pair: str
    z: float
    signal: int
    beta: float
    spread: float
    half_life: int
    xgb_prob: float
    kelly_size: float
    timestamp: float = field(default_factory=time.time)