import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# test_ws.py
import asyncio
from data.streamer import stream_closed_bars

async def main():
    # Using the USDT pairs to avoid the 'p' KeyError
    symbols = ["BTCUSD", "ETHUSD"]
    
    print(f"Connecting to Binance 5m Kline WS for {symbols}...")
    print("Waiting for the next 5-minute candle to close. This may take up to 5 minutes...")
    
    try:
        # Loop through the async generator
        async for closed_bar in stream_closed_bars(symbols):
            print("\n" + "="*40)
            print(f"BAR CLOSED: {closed_bar['symbol']}")
            print(f"Timestamp : {closed_bar['timestamp']}")
            print(f"Close     : {closed_bar['close']}")
            print(f"Volume    : {closed_bar['volume']}")
            print("="*40)
            
    except KeyboardInterrupt:
        print("\nTest stopped by user.")
    except Exception as e:
        print(f"\nError during test: {e}")

if __name__ == "__main__":
    asyncio.run(main())