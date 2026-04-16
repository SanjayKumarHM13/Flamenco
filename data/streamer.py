from email import message
import asyncio
import websockets
import json
import logging
import time
from data.binance_ws import format_stream_names
from config import BINANCE_WS_BASE_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def stream_closed_bars(rank, symbols):
    """
    Manages the async WebSocket lifecycle with exponential backoff.
    Yields normalized tick data to the worker.
    """

    streams = format_stream_names(symbols=symbols)
    attempt = 0

    while True:
        try:
            # Using ping_interval/timeout to keep the connection alive
            async with websockets.connect(BINANCE_WS_BASE_URL, ping_interval=20, ping_timeout=20) as ws:
                logger.info(f"\t[RANK {rank}] Connected to Binance WS. Sending subscription for {len(symbols)} symbols...")
                
                # Subscription payload
                sub_payload = {
                    "method": "SUBSCRIBE",
                    "params": streams,
                    "id": int(time.time())
                }

                # Sending the request
                await ws.send(json.dumps(sub_payload))
                logger.info(f"\t[RANK {rank}] Subscription request sent.")
                attempt = 0

                while True:
                    message = await ws.recv()
                    data = json.loads(message)

                    # logging confirmation from Binance that the subscription worked
                    if 'result' in data and data['result'] is None:
                        logger.info(f"\t[RANK {rank}] Subscription successful.")
                        continue

                    # Catching errors
                    if 'error' in data:
                        logger.error(f"[RANK {rank}] WS Error: {data['error']}")
                        await asyncio.sleep(5)
                        raise ValueError(f"[RANK {rank}] Stream error")


                    if data.get('e') == 'kline':
                        kline = data['k']

                        if kline['x'] is True:
                            yield {
                                "symbol": data['s'],
                                "timestamp": kline['t'],
                                "open": float(kline['o']),
                                "high": float(kline['h']),
                                "low": float(kline['l']),
                                "close": float(kline['c']),
                                "volume": float(kline['v'])
                            }

        
        except (websockets.exceptions.ConnectionClosedError, Exception) as e:
            delay = min(2 ** attempt, 30)
            logger.warning(f"[RANK {rank}] WS Disconnected: {e}. Reconnecting in {delay}s...")
            await asyncio.sleep(delay)
            attempt += 1
