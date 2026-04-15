from config import KLINE_INTERVAL

def format_stream_names(symbols):

    if not symbols:
        raise ValueError("Symbol is required")

    return [f"{cc.lower()}@kline_{KLINE_INTERVAL}" for cc in symbols]