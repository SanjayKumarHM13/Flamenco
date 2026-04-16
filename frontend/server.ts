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
  ticker: { g_conf: number; pos: number; pnl: number; pairs: Record<string, TickerData> } | null;
  system: SystemUpdateData | null;
  logs: LogEventData[];
} = {
  ticker: {
    g_conf: 0.0,
    pos: 0,
    pnl: 0.0,
    pairs: {}
  },
  system: {
    circuit_breaker: { status: "Pending Sync", used: 0 },
    nodes: {
      "Rank0": { role: "Master", host: "Master Node", cpu: 0, ram: 0, status: "Offline" as const }
    },
    pair_stats: {},
    lstm: {
      regime: "MEAN_REVERTING",
      confidence: 0.0,
      heatmap: Array.from({ length: 7 }, () => Array.from({ length: 60 }, () => 0))
    },
    meta_allocations: []
  },
  logs: [
    { t: new Date().toISOString(), msg: "Waiting for first tick via MPI Gather. Depending on the Binance timeframe, this takes 1 interval...", type: "system" as const }
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
      } else if (msg.action === "backend_update") {
        // Python backend sending data — deep-merge so each worker's pair is preserved
        if (msg.payload.ticker && state.ticker) {
          state.ticker = {
            ...state.ticker,
            ...msg.payload.ticker,
            pairs: { ...state.ticker.pairs, ...msg.payload.ticker.pairs }
          };
          broadcast({ type: "ticker_update", data: state.ticker });
        }
        if (msg.payload.system && state.system) {
          const incoming = msg.payload.system;
          const existingAllocs = state.system.meta_allocations.filter(
            (a: any) => !incoming.meta_allocations.find((b: any) => b.pair === a.pair)
          );
          state.system = {
            ...state.system,
            ...incoming,
            nodes: { ...state.system.nodes, ...incoming.nodes },
            pair_stats: { ...state.system.pair_stats, ...incoming.pair_stats },
            meta_allocations: [...existingAllocs, ...incoming.meta_allocations]
          };
          broadcast({ type: "system_update", data: state.system });
        }
        if (msg.payload.log) {
          state.logs.unshift(msg.payload.log);
          broadcast({ type: "log_event", data: msg.payload.log });
        }
        if (msg.payload.equity) {
          equityHistory.push(msg.payload.equity);
          broadcast({ type: "equity_update", data: msg.payload.equity });
        }
      }
    });
  });

  // --- Simulation Loops removed due to python connection ---

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
