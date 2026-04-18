# execution/mt5_router.py
import MetaTrader5 as mt5
import time

class MT5Router:
    def __init__(self, account_id, password, server):
        self.account_id = account_id
        self.password = password
        self.server = server
        self.magic_number = 7772026 # Unique ID so we know the AI placed this trade

        print("Connecting to MetaTrader 5...")
        # Initialize the MT5 connection
        if not mt5.initialize():
            print("initialize() failed. Ensure MT5 is open.")
            mt5.shutdown()
            return
            
        # Log into the account
        authorized = mt5.login(self.account_id, password=self.password, server=self.server)
        if authorized:
            print(f"Connected to MT5 Account: {self.account_id}")
        else:
            print(f"Failed to connect. Error code: {mt5.last_error()}")

    def _place_market_order(self, symbol, order_type, volume):
        """Internal helper to format the strict MT5 order dictionary."""
        # Ensure the symbol is visible in the Market Watch
        # Common mapping: if BTCUSDT isn't found, try BTCUSD or BTC.
        search_symbols = [symbol, symbol.replace("USDT", "USD"), symbol.replace("USDT", "")]
        actual_symbol = None
        
        for s in search_symbols:
            if mt5.symbol_select(s, True):
                actual_symbol = s
                break
        
        if not actual_symbol:
            print(f"Symbol {symbol} and variants not found in Market Watch. Check MT5 Symbols list.")
            return None

        # Get current tick data (needed for pricing)
        tick = mt5.symbol_info_tick(actual_symbol)
        if tick is None:
            print(f"Failed to get tick data for {actual_symbol}. Last error: {mt5.last_error()}")
            return None

        # Determine price based on Buy (Ask) or Sell (Bid)
        price = tick.ask if order_type == mt5.ORDER_TYPE_BUY else tick.bid
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": actual_symbol,
            "volume": float(volume),
            "type": order_type,
            "price": price,
            "deviation": 10, # Max slippage in points
            "magic": self.magic_number,
            "comment": "AI_Spread_Trade",
            "type_time": mt5.ORDER_TIME_GTC, # Good till cancelled
            "type_filling": mt5.ORDER_FILLING_IOC, # Immediate or Cancel
        }

        # Send order to MT5
        result = mt5.order_send(request)
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            print(f"Order failed for {symbol}: retcode={result.retcode}")
            return None
            
        print(f"Order Success: {symbol} | Type: {'BUY' if order_type == 0 else 'SELL'} | Vol: {volume} @ {price}")
        return result

    def route_spread_trade(self, pair_name, total_dollar_risk, price_y, price_x, z_score):
        """
        Calculates lot sizes and executes both legs of the spread trade.
        """
        # Example pair_name: "BTCUSD/ETHUSD"
        symbol_y, symbol_x = pair_name.split("/")
        
        # 1. Split the Kelly capital between the two legs (Dollar Neutrality)
        dollars_y = total_dollar_risk / 2
        dollars_x = total_dollar_risk / 2
        
        # 2. Convert Dollars to MT5 Lots (Volume)
        # Note: You may need to multiply by contract size depending on your broker!
        vol_y = round(dollars_y / price_y, 2)
        vol_x = round(dollars_x / price_x, 2)
        
        print(f"[MT5] Target Volumes: {symbol_y}={vol_y}, {symbol_x}={vol_x}")

        # Prevent zero-lot errors
        if vol_y <= 0 or vol_x <= 0:
            print(f"[MT5] Trade size too small for ${total_dollar_risk:.2f} risk. ({vol_y}, {vol_x}). Increase TOTAL_PORTFOLIO_VALUE in config.py.")
            return

        print(f"\nExecuting Spread: {pair_name} | Total AI Allocation: ${total_dollar_risk:.2f}")

        # 3. Determine Direction based on Z-Score
        if z_score < 0:
            # Spread is undervalued: BUY Y, SELL X
            self._place_market_order(symbol_y, mt5.ORDER_TYPE_BUY, vol_y)
            self._place_market_order(symbol_x, mt5.ORDER_TYPE_SELL, vol_x)
        else:
            # Spread is overvalued: SELL Y, BUY X
            self._place_market_order(symbol_y, mt5.ORDER_TYPE_SELL, vol_y)
            self._place_market_order(symbol_x, mt5.ORDER_TYPE_BUY, vol_x)

    def shutdown(self):
        mt5.shutdown()