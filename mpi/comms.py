from dataclasses import dataclass, field
import time
import platform
import os

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
    cpu: float = 0.0
    ram: float = 0.0
    cores: int = os.cpu_count() or 1
    hostname: str = field(default_factory=lambda: platform.node())
    timestamp: float = field(default_factory=time.time)