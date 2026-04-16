from dataclasses import dataclass, field
import time

@dataclass
class TradeSignal:
    rank: int
    pair: str
    z_score: float
    beta: float
    variance: float
    spread: float
    half_life: int
    ai_confidence: float
    kelly_size: float
    price_y: float
    price_x: float
    timestamp: float = field(default_factory=time.time)