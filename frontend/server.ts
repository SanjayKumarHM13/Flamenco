import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { 
  TickerData, 
  SystemUpdateData, 
  LogEventData, 
  WsMessage, 
  RegimeState, 
  EquityPoint,
  User
} from "./src/types";

const app = express();
app.use(express.json());
const PORT = 3000;

// --- Mock Database ---
const users: User[] = [
  { id: "1", email: "demo@example.com", name: "Demo User" }
];

// --- Auth Endpoints ---
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (user && password === "password") { // Simple mock
    res.json({ user, token: "mock-jwt-token" });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post("/api/auth/register", (req, res) => {
  const { email, name, password } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: "User already exists" });
  }
  const newUser = { id: String(users.length + 1), email, name };
  users.push(newUser);
  res.json({ user: newUser, token: "mock-jwt-token" });
});

// --- News Endpoint ---
app.get("/api/news", (req, res) => {
  res.json([
    { id: 1, title: "Fed Signals Potential Rate Cut in Q3", source: "Reuters", time: "10m ago", impact: "high" },
    { id: 2, title: "BTC Surges Past $70k on Institutional Inflow", source: "CoinDesk", time: "25m ago", impact: "medium" },
    { id: 3, title: "NVIDIA Earnings Beat Expectations, AI Sector Rallies", source: "Bloomberg", time: "1h ago", impact: "high" },
    { id: 4, title: "Oil Prices Stabilize Amid Middle East Tensions", source: "CNBC", time: "2h ago", impact: "low" },
  ]);
});

// --- State Simulation ---
let equityHistory: EquityPoint[] = Array.from({ length: 50 }, (_, i) => ({
  t: new Date(Date.now() - (50 - i) * 60000).toISOString(),
  balance: 10000 + Math.random() * 500 - 250 + i * 10
}));

const state: {
  ticker: { g_conf: number; pos: number; pnl: number; pairs: Record<string, TickerData> };
  system: SystemUpdateData;
  logs: LogEventData[];
} = {
  ticker: {
    g_conf: 0.74,
    pos: 2,
    pnl: 184.20,
    pairs: {
      "BTC/ETH": { 
        z: -2.41, spread: -142.3, sig: "Long" as const, xgb: 0.71, k: 0.18, pnl: 97.40,
        p_trend: Array.from({ length: 20 }, () => Math.random() * 0.1),
        beta_var: 0.002,
        features: { "Z-Score": 0.4, "VIX": 0.2, "Volume": 0.15, "Momentum": 0.25 }
      },
      "BTC/SOL": { 
        z: 2.09, spread: 88.7, sig: "Short" as const, xgb: 0.63, k: 0.14, pnl: 56.80,
        p_trend: Array.from({ length: 20 }, () => Math.random() * 0.1),
        beta_var: 0.003,
        features: { "Z-Score": 0.35, "VIX": 0.25, "Volume": 0.1, "Momentum": 0.3 }
      },
      "ETH/SOL": { 
        z: 0.45, spread: 12.1, sig: "Flat" as const, xgb: 0.48, k: 0.0, pnl: 30.00,
        p_trend: Array.from({ length: 20 }, () => Math.random() * 0.1),
        beta_var: 0.001,
        features: { "Z-Score": 0.2, "VIX": 0.3, "Volume": 0.2, "Momentum": 0.3 }
      }
    }
  },
  system: {
    circuit_breaker: { status: "Armed", used: 0.4 },
    nodes: {
      "Rank0": { role: "Master", host: "Laptop A", cpu: 8, ram: 290, status: "Online" as const },
      "Rank1": { role: "Worker", host: "Node B", cpu: 12, ram: 410, status: "Online" as const, pair: "BTC/ETH" },
      "Rank2": { role: "Worker", host: "Node C", cpu: 15, ram: 380, status: "Online" as const, pair: "BTC/SOL" },
      "Rank3": { role: "Worker", host: "Node D", cpu: 9, ram: 310, status: "Online" as const, pair: "ETH/SOL" }
    },
    pair_stats: {
      "BTC/ETH": { beta: 0.842, halfLife: 14, trades: "12W / 4L" },
      "BTC/SOL": { beta: 1.125, halfLife: 22, trades: "8W / 6L" },
      "ETH/SOL": { beta: 0.654, halfLife: 18, trades: "5W / 2L" }
    },
    lstm: {
      regime: "MEAN_REVERTING" as RegimeState,
      confidence: 0.88,
      heatmap: Array.from({ length: 7 }, () => Array.from({ length: 60 }, () => Math.random()))
    },
    meta_allocations: [
      { pair: "BTC/ETH", prob: 0.82, allocated: true, kelly: 0.18 },
      { pair: "BTC/SOL", prob: 0.74, allocated: true, kelly: 0.14 },
      { pair: "ETH/SOL", prob: 0.45, allocated: false, kelly: 0.0 }
    ]
  },
  logs: [
    { t: new Date().toISOString(), msg: "System initialized. MPI cluster online.", type: "system" as const },
    { t: new Date().toISOString(), msg: "LSTM Regime: MEAN_REVERTING detected (conf: 0.88)", type: "ai" as const }
  ]
};

// --- WebSocket Server ---
async function startServer() {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server, path: "/ws/dashboard" });

  const broadcast = (msg: WsMessage) => {
    const data = JSON.stringify(msg);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  wss.on("connection", (ws) => {
    console.log("Client connected to dashboard");
    ws.send(JSON.stringify({ 
      type: "full_state", 
      data: { ...state, equity: equityHistory } 
    }));

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.action === "execute_trade") {
        const { pair, direction } = msg.payload;
        const event: LogEventData = {
          t: new Date().toISOString(),
          msg: `Manual ${direction} executed on ${pair} at market.`,
          type: "trade" as const
        };
        state.logs.unshift(event);
        broadcast({ type: "log_event", data: event });

        // Update equity on trade
        const lastEquity = equityHistory[equityHistory.length - 1].balance;
        const newPoint = { t: new Date().toISOString(), balance: lastEquity + (Math.random() * 100 - 40) };
        equityHistory.push(newPoint);
        broadcast({ type: "equity_update", data: newPoint });

        setTimeout(() => {
          broadcast({
            type: "trade_confirm",
            data: { pair, status: "success", ticket: Math.floor(Math.random() * 100000), execution_price: 65000 }
          });
        }, 800);
      }
    });
  });

  // --- Simulation Loops ---
  setInterval(() => {
    // Fast tick: Update prices/z-scores
    Object.keys(state.ticker.pairs).forEach(pair => {
      const p = state.ticker.pairs[pair as keyof typeof state.ticker.pairs];
      p.z += (Math.random() - 0.5) * 0.2;
      p.spread += (Math.random() - 0.5) * 5;
      p.pnl += (Math.random() - 0.5) * 2;
      p.p_trend.push(Math.random() * 0.1);
      p.p_trend.shift();
    });
    state.ticker.pnl = Object.values(state.ticker.pairs).reduce((acc, p) => acc + p.pnl, 0);
    
    broadcast({ type: "ticker_update", data: state.ticker });
  }, 1000);

  setInterval(() => {
    // Slow tick: Update system state
    state.system.circuit_breaker.used = Math.min(1, state.system.circuit_breaker.used + (Math.random() - 0.5) * 0.05);
    
    const regimes: any[] = ["MEAN_REVERTING", "TRENDING", "UNSTABLE"];
    if (Math.random() > 0.8) {
      state.system.lstm.regime = regimes[Math.floor(Math.random() * regimes.length)];
      state.system.lstm.confidence = 0.6 + Math.random() * 0.3;
    }

    // Update heatmap
    state.system.lstm.heatmap.forEach(row => {
      row.push(Math.random());
      row.shift();
    });

    broadcast({ type: "system_update", data: state.system });
  }, 10000);

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

startServer();
