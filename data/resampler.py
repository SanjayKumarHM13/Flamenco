# No need of this class!!!
# We can use the kline data from the websocket
        
class TickResampler:
    def __init__(self, timeframe_minutes=5):
        # Convert minutes to milliseconds (Binance timestamps are in ms)
        self.ts_ms = timeframe_minutes * 60 * 1000
        self.current_bars = {}

    def process_tick(self, tick):
        """
        Processes a single tick. 
        Returns a completed OHLCV dict if a bar closes, otherwise returns None.
        """
        symbol = tick['symbol']
        price = tick['price']
        vol = tick['volume']
        ts = tick['timestamp']

        # Calculate the starting millisecond of the current 5-minute bucket
        bar_timestamp = (ts // self.ts_ms) * self.ts_ms

        if symbol not in self.current_bars:
            self._start_new_bar(symbol, price, vol, bar_timestamp)
            return None

        current_bar = self.current_bars[symbol]

        # 2. Check if the tick has crossed into the NEXT t-minute candle
        if bar_timestamp > current_bar['timestamp']:
            completed_bar = current_bar.copy()

            self._start_new_bar(symbol, price, vol, bar_timestamp)
            return completed_bar

        # 3. If none of the above, update the current candle
        current_bar['high'] = max(current_bar['high'], price)
        current_bar['low'] = min(current_bar['low'], price)
        current_bar['close'] = price
        current_bar['volume'] += vol

        return None

    def _start_new_bar(self, symbol, price, vol, timestamp):
        self.current_bars[symbol] = {
            'symbol': symbol,
            'open': price,
            'high': price,
            'low': price,
            'close': price,
            'volume': vol,
            'timestamp': timestamp
        }
