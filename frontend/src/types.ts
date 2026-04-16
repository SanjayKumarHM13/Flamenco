export type Signal = "Long" | "Short" | "Flat";
export type NodeStatus = "Online" | "Offline" | "Degraded";
export type RegimeState = "MEAN_REVERTING" | "TRENDING" | "UNSTABLE";

export interface TickerData {
  z: number;
  spread: number;
  sig: Signal;
  xgb: number; // Layer 1: Local XGBoost score
  k: number;
  pnl: number;
  p_trend: number[]; // EG p-value trend
  beta_var: number; // Kalman posterior variance
  features: Record<string, number>; // Local XGBoost feature importance/values
}

export interface NodeData {
  role: string;
  pair?: string;
  host: string;
  cpu: number;
  ram: number;
  status: NodeStatus;
}

export interface PairStat {
  beta: number;
  halfLife: number;
  trades: string;
}

export interface LstmData {
  regime: RegimeState;
  confidence: number;
  heatmap: number[][]; // 7 features x 60 bars
}

export interface MetaModelAllocation {
  pair: string;
  prob: number;
  allocated: boolean;
  kelly: number;
}

export interface SystemUpdateData {
  circuit_breaker: {
    status: string;
    used: number;
  };
  nodes: Record<string, NodeData>;
  pair_stats: Record<string, PairStat>;
  lstm: LstmData; // Layer 2: Master LSTM
  meta_allocations: MetaModelAllocation[]; // Layer 3: Master XGBoost Meta-model
}

export interface LogEventData {
  t: string; // timestamp
  msg: string; // reasoning message
  type: "ai" | "trade" | "system";
}

export interface TradeConfirmData {
  pair: string;
  status: "success" | "failed";
  ticket: number;
  execution_price: number;
}

export interface EquityPoint {
  t: string;
  balance: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export type WsMessage =
  | { type: "full_state"; data: { ticker: { g_conf: number; pos: number; pnl: number; pairs: Record<string, TickerData> }; system: SystemUpdateData; logs: LogEventData[]; equity: EquityPoint[] } }
  | { type: "ticker_update"; data: { g_conf: number; pos: number; pnl: number; pairs: Record<string, TickerData> } }
  | { type: "system_update"; data: SystemUpdateData }
  | { type: "log_event"; data: LogEventData }
  | { type: "trade_confirm"; data: TradeConfirmData }
  | { type: "equity_update"; data: EquityPoint };

export interface ExecuteTradePayload {
  pair: string;
  direction: string;
  kelly_size: number;
}

export interface ToggleAutoPayload {
  pair: string;
  auto_enabled: boolean;
}

export type ClientMessage =
  | { action: "execute_trade"; payload: ExecuteTradePayload }
  | { action: "toggle_auto"; payload: ToggleAutoPayload };
