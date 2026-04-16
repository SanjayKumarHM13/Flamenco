import React, { useEffect, useState, useRef } from "react";
import { PairCard } from "./components/PairCard";
import { MpiTopology } from "./components/MpiTopology";
import { SignalLog } from "./components/SignalLog";
import { AiCommandCenter } from "./components/AiCommandCenter";
import { AiReasoningFeed } from "./components/AiReasoningFeed";
import { EquityChart } from "./components/EquityChart";
import { KpiGrid } from "./components/KpiGrid";
import { TradingChat } from "./components/TradingChat";
import { AuthScreen } from "./components/AuthScreen";
import { SettingsPage } from "./components/SettingsPage";
import { 
  TickerData, 
  SystemUpdateData, 
  NodeData, 
  LogEventData, 
  WsMessage, 
  ClientMessage, 
  EquityPoint,
  AuthState,
  User
} from "./types";
import { 
  Brain, 
  LogOut, 
  Settings, 
  Bell, 
  Search, 
  Menu, 
  TrendingUp, 
  History as HistoryIcon, 
  Briefcase, 
  LayoutDashboard,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  User as UserIcon,
  Shield,
  Clock
} from "lucide-react";
import { cn } from "./lib/utils";
import { TooltipProvider } from "./components/ui/tooltip";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { ScrollArea } from "./components/ui/scroll-area";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "./components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";

type View = "dashboard" | "markets" | "portfolio" | "history" | "settings";

export default function App() {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem("spread_os_auth");
    return saved ? JSON.parse(saved) : { user: null, token: null, isAuthenticated: false };
  });

  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [ticker, setTicker] = useState<{ g_conf: number; pos: number; pnl: number; pairs: Record<string, TickerData> } | null>(null);
  const [system, setSystem] = useState<SystemUpdateData | null>(null);
  const [logs, setLogs] = useState<LogEventData[]>([]);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const socketRef = useRef<WebSocket | null>(null);

  // Dummy Data for Views
  const portfolioData = [
    { asset: "BTC/USD", amount: "1.24", avgPrice: "64,230.50", currentPrice: "65,120.00", pnl: "+1,102.98" },
    { asset: "ETH/USD", amount: "15.5", avgPrice: "3,450.20", currentPrice: "3,420.10", pnl: "-466.55" },
    { asset: "SOL/USD", amount: "120.0", avgPrice: "142.50", currentPrice: "145.80", pnl: "+396.00" },
    { asset: "AAPL", amount: "50.0", avgPrice: "172.10", currentPrice: "175.40", pnl: "+165.00" },
  ];

  const historyData = [
    { date: "2024-04-16 10:24:12", action: "BUY", pair: "BTC/USD", amount: "0.05", price: "64,850.00" },
    { date: "2024-04-16 09:15:05", action: "SELL", pair: "ETH/USD", amount: "2.10", price: "3,445.20" },
    { date: "2024-04-15 22:40:55", action: "BUY", pair: "SOL/USD", amount: "15.0", price: "141.20" },
    { date: "2024-04-15 18:12:30", action: "SELL", pair: "BTC/USD", amount: "0.12", price: "65,100.00" },
    { date: "2024-04-15 14:05:10", action: "BUY", pair: "AAPL", amount: "10.0", price: "171.50" },
  ];

  const marketSummaries = [
    { symbol: "BTC/USD", price: "65,120.00", change: "+2.4%", trend: "up" },
    { symbol: "ETH/USD", price: "3,420.10", change: "-1.2%", trend: "down" },
    { symbol: "Crude Oil", price: "85.42", change: "+0.8%", trend: "up" },
    { symbol: "S&P 500", price: "5,123.40", change: "+0.5%", trend: "up" },
  ];

  const newsHeadlines = [
    { title: "Fed Signals Potential Rate Cut in Q3", source: "Reuters", time: "10m ago", impact: "high" },
    { title: "BTC Surges Past $70k Resistance Level", source: "CoinDesk", time: "25m ago", impact: "medium" },
    { title: "NVIDIA Earnings Beat Analyst Expectations", source: "Bloomberg", time: "1h ago", impact: "high" },
    { title: "Oil Prices Stabilize Amid Geopolitical Tensions", source: "CNBC", time: "2h ago", impact: "medium" },
    { title: "New Crypto Regulations Proposed in EU", source: "The Block", time: "3h ago", impact: "low" },
    { title: "Tech Stocks Rally on AI Optimism", source: "Financial Times", time: "4h ago", impact: "medium" },
  ];

  const notifications = [
    { id: "ntf-1", msg: "BTC/USD Spread widened beyond threshold", time: "2m ago", type: "warning" },
    { id: "ntf-2", msg: "Trade Executed: BUY 0.5 BTC/USD", time: "15m ago", type: "success" },
    { id: "ntf-3", msg: "System: MPI Node 4 reconnected", time: "1h ago", type: "info" },
  ];

  useEffect(() => {
    if (!auth.isAuthenticated) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const socket = new WebSocket(`${protocol}//${host}/ws/dashboard`);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket Connected");
    };

    socket.onmessage = (event) => {
      const message: WsMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case "full_state":
          setTicker(message.data.ticker);
          setSystem(message.data.system);
          setLogs(message.data.logs);
          setEquity(message.data.equity);
          break;
        case "ticker_update":
          setTicker(prev => prev ? { ...prev, ...message.data } : (message.data as any));
          break;
        case "system_update":
          setSystem(message.data);
          break;
        case "log_event":
          setLogs(prev => [message.data, ...prev].slice(0, 50));
          break;
        case "equity_update":
          setEquity(prev => [...prev, message.data].slice(-100));
          break;
        case "trade_confirm":
          // Show notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Trade Executed", { body: `${message.data.pair} ${message.data.status} at ${message.data.execution_price}` });
          }
          break;
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket Disconnected");
    };

    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      socket.close();
      clearInterval(timeInterval);
    };
  }, [auth.isAuthenticated]);

  const handleLogin = async (email: string, pass: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (res.ok) {
      const newState = { user: data.user, token: data.token, isAuthenticated: true };
      setAuth(newState);
      localStorage.setItem("spread_os_auth", JSON.stringify(newState));
    } else {
      throw new Error(data.error);
    }
  };

  const handleRegister = async (email: string, name: string, pass: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password: pass })
    });
    const data = await res.json();
    if (res.ok) {
      const newState = { user: data.user, token: data.token, isAuthenticated: true };
      setAuth(newState);
      localStorage.setItem("spread_os_auth", JSON.stringify(newState));
    } else {
      throw new Error(data.error);
    }
  };

  const handleLogout = () => {
    setAuth({ user: null, token: null, isAuthenticated: false });
    localStorage.removeItem("spread_os_auth");
  };

  const sendMessage = (msg: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  if (!auth.isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }

  if (!ticker || !system) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Brain className="w-12 h-12 text-blue-500 animate-pulse" />
          <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
            {isConnected ? "Synchronizing AI Layers..." : "Connecting to Flamenco..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-blue-500/30">
        {/* Top Navigation */}
        <nav className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-40">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">Flamenco</h1>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Button 
                variant="ghost" 
                onClick={() => setCurrentView("dashboard")}
                className={cn("text-xs font-bold uppercase tracking-widest transition-all", currentView === "dashboard" ? "text-blue-400 bg-blue-400/10" : "text-zinc-500 hover:text-white")}
              >
                Dashboard
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setCurrentView("markets")}
                className={cn("text-xs font-bold uppercase tracking-widest transition-all", currentView === "markets" ? "text-blue-400 bg-blue-400/10" : "text-zinc-500 hover:text-white")}
              >
                Markets
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setCurrentView("portfolio")}
                className={cn("text-xs font-bold uppercase tracking-widest transition-all", currentView === "portfolio" ? "text-blue-400 bg-blue-400/10" : "text-zinc-500 hover:text-white")}
              >
                Portfolio
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setCurrentView("history")}
                className={cn("text-xs font-bold uppercase tracking-widest transition-all", currentView === "history" ? "text-blue-400 bg-blue-400/10" : "text-zinc-500 hover:text-white")}
              >
                History
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 w-64">
              <Search className="w-4 h-4 text-zinc-500 mr-2" />
              <input type="text" placeholder="Search pairs, assets..." className="bg-transparent border-none outline-none text-xs w-full text-zinc-300" />
            </div>
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-white relative">
                      <Bell className="w-5 h-5" />
                      <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-zinc-950" />
                    </Button>
                  }
                />
                <DropdownMenuContent className="bg-zinc-900 border-zinc-800 w-80 p-2 rounded-2xl shadow-2xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs font-bold uppercase tracking-widest text-zinc-500 p-2">Recent Alerts</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    {notifications.map((n) => (
                      <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-3 rounded-xl hover:bg-zinc-800 cursor-pointer transition-all">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-1.5 h-1.5 rounded-full", n.type === "warning" ? "bg-rose-500" : n.type === "success" ? "bg-emerald-500" : "bg-blue-500")} />
                          <span className="text-xs font-bold text-white">{n.msg}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono ml-3.5">{n.time}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem className="justify-center text-[10px] font-bold uppercase tracking-widest text-blue-400 p-2 hover:bg-blue-400/10 rounded-xl cursor-pointer">View All Notifications</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="icon" className={cn("transition-all", currentView === "settings" ? "text-blue-400 bg-blue-400/10" : "text-zinc-500 hover:text-white")} onClick={() => setCurrentView("settings")}>
                <Settings className="w-5 h-5" />
              </Button>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-white">{auth.user?.name}</p>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Pro Trader</p>
                </div>
                <Avatar className="h-8 w-8 border border-zinc-800">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.user?.email}`} />
                  <AvatarFallback>{auth.user?.name?.[0]}</AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-rose-400" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <main className="p-6 max-w-[1800px] mx-auto space-y-8">
          {currentView === "dashboard" && (
            <>
              {/* Top Section: KPIs and Equity Chart */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-8 space-y-8">
                  <KpiGrid 
                    pnl={ticker.pnl} 
                    pos={ticker.pos} 
                    winRate={74} 
                    drawdown={4.2} 
                  />
                  <EquityChart data={equity} />
                </div>
                <div className="xl:col-span-4">
                  <AiReasoningFeed logs={logs} />
                </div>
              </div>

              {/* Middle Section: AI Command Center */}
              <AiCommandCenter lstm={system.lstm} metaAllocations={system.meta_allocations} />

              {/* Bottom Section: Pair Grid and Topology */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-9 space-y-8">
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="hardware-label">Active Worker Ranks — Local XGBoost Scopes</h2>
                      <div className="flex gap-4 text-[10px] font-mono text-zinc-500">
                        <span className={cn(isConnected ? "text-emerald-400" : "text-rose-400")}>
                          {isConnected ? "ENGINE LIVE" : "ENGINE OFFLINE"}
                        </span>
                        <span>{currentTime.toISOString().split('T')[1].split('.')[0]} UTC</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {(Object.entries(ticker.pairs) as [string, TickerData][]).map(([pairName, pairData]) => {
                        const nodeEntry = (Object.entries(system.nodes) as [string, NodeData][]).find(([_, n]) => n.pair === pairName);
                        const node = nodeEntry ? nodeEntry[1] : { host: "N/A", cpu: 0, ram: 0, role: "N/A", status: "Offline" as const };
                        const stats = system.pair_stats[pairName] || { beta: 0, halfLife: 0, trades: "0W / 0L" };
                        
                        return (
                          <PairCard 
                            key={pairName} 
                            pairName={pairName}
                            data={pairData} 
                            node={node}
                            stats={stats}
                            onTrade={(direction) => sendMessage({
                              action: "execute_trade",
                              payload: { pair: pairName, direction, kelly_size: pairData.k }
                            })}
                            onToggleAuto={(enabled) => sendMessage({
                              action: "toggle_auto",
                              payload: { pair: pairName, auto_enabled: enabled }
                            })}
                          />
                        );
                      })}
                    </div>
                  </section>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <MpiTopology nodes={system.nodes} />
                    <SignalLog logs={logs} />
                  </div>
                </div>

                {/* Sidebar: News and Alerts */}
                <div className="lg:col-span-3 space-y-8">
                  <div className="hardware-card p-6">
                    <h3 className="hardware-label mb-4">Global Market News</h3>
                    <div className="space-y-4">
                      {newsHeadlines.slice(0, 3).map((news, i) => (
                        <div key={i} className="group cursor-pointer">
                          <div className="flex justify-between items-start mb-1">
                            <span className={cn(
                              "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                              news.impact === "high" ? "bg-rose-500/20 text-rose-400" : "bg-blue-500/20 text-blue-400"
                            )}>
                              {news.impact} impact
                            </span>
                            <span className="text-[9px] text-zinc-600 font-mono">{news.time}</span>
                          </div>
                          <h4 className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">{news.title}</h4>
                          <p className="text-[10px] text-zinc-500 font-mono">{news.source}</p>
                        </div>
                      ))}
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowNewsModal(true)}
                      className="w-full mt-4 text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest"
                    >
                      View All News
                    </Button>
                  </div>

                  <div className="hardware-card p-6">
                    <h3 className="hardware-label mb-4">Active Alerts</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-emerald-400">BTC/ETH Z-Score {">"} 2.0</span>
                      </div>
                      <div className="flex items-center gap-3 p-2 rounded bg-zinc-900 border border-zinc-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                        <span className="text-[10px] font-mono text-zinc-500">VIX Volatility Spike {">"} 15%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {currentView === "portfolio" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Briefcase className="w-6 h-6 text-blue-500" />
                <h2 className="text-2xl font-black tracking-tighter uppercase italic">Current Holdings</h2>
              </div>
              <div className="hardware-card overflow-hidden">
                <table className="w-full text-left font-mono text-sm">
                  <thead className="bg-zinc-900/50 border-b border-zinc-800">
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      <th className="p-4">Asset</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Avg Price</th>
                      <th className="p-4">Current Price</th>
                      <th className="p-4 text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {portfolioData.map((item, i) => (
                      <tr key={i} className="hover:bg-zinc-900/30 transition-all">
                        <td className="p-4 font-bold text-white">{item.asset}</td>
                        <td className="p-4 text-zinc-400">{item.amount}</td>
                        <td className="p-4 text-zinc-400">${item.avgPrice}</td>
                        <td className="p-4 text-zinc-400">${item.currentPrice}</td>
                        <td className={cn("p-4 text-right font-bold", item.pnl.startsWith("+") ? "text-emerald-400" : "text-rose-400")}>
                          {item.pnl}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentView === "history" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <HistoryIcon className="w-6 h-6 text-blue-500" />
                <h2 className="text-2xl font-black tracking-tighter uppercase italic">Transaction Logs</h2>
              </div>
              <div className="hardware-card overflow-hidden">
                <table className="w-full text-left font-mono text-sm">
                  <thead className="bg-zinc-900/50 border-b border-zinc-800">
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      <th className="p-4">Date/Time</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Trading Pair</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {historyData.map((item, i) => (
                      <tr key={i} className="hover:bg-zinc-900/30 transition-all">
                        <td className="p-4 text-zinc-500 text-xs">{item.date}</td>
                        <td className="p-4">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", item.action === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                            {item.action}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-white">{item.pair}</td>
                        <td className="p-4 text-zinc-400">{item.amount}</td>
                        <td className="p-4 text-right text-zinc-400">${item.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentView === "markets" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Globe className="w-6 h-6 text-blue-500" />
                <h2 className="text-2xl font-black tracking-tighter uppercase italic">Global Markets</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {marketSummaries.map((market, i) => (
                  <div key={i} className="hardware-card p-6 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <span className="hardware-label">{market.symbol}</span>
                      {market.trend === "up" ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-rose-400" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl font-black font-mono tracking-tighter">${market.price}</span>
                      <span className={cn("text-xs font-bold", market.trend === "up" ? "text-emerald-400" : "text-rose-400")}>
                        {market.change}
                      </span>
                    </div>
                    <div className="h-12 w-full bg-zinc-900/50 rounded-lg flex items-end gap-1 p-1">
                      {[...Array(12)].map((_, j) => (
                        <div 
                          key={j} 
                          className={cn("flex-1 rounded-t-[1px]", market.trend === "up" ? "bg-emerald-500/20" : "bg-rose-500/20")} 
                          style={{ height: `${20 + Math.random() * 80}%` }} 
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentView === "settings" && <SettingsPage />}
        </main>

        {/* News Modal */}
        <Dialog open={showNewsModal} onOpenChange={setShowNewsModal}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-white rounded-3xl max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tighter uppercase italic">Global Market News</DialogTitle>
              <DialogDescription className="text-zinc-500">Real-time intelligence feed from global sources.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 py-4">
                {newsHeadlines.map((news, i) => (
                  <div key={i} className="group p-4 rounded-2xl bg-zinc-900/30 border border-zinc-800/50 hover:bg-zinc-900/50 transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[8px] font-bold px-2 py-0.5 rounded uppercase",
                          news.impact === "high" ? "bg-rose-500/20 text-rose-400" : news.impact === "medium" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
                        )}>
                          {news.impact} impact
                        </span>
                        <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{news.time}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">{news.source}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors leading-relaxed">{news.title}</h4>
                    <p className="text-xs text-zinc-500 mt-2 line-clamp-2">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t border-zinc-800">
              <Button variant="ghost" className="w-full rounded-xl h-11 font-bold uppercase tracking-widest text-zinc-500 hover:text-white" onClick={() => setShowNewsModal(false)}>
                Close Feed
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Assistant Chat */}
        <TradingChat />
      </div>
    </TooltipProvider>
  );
}
