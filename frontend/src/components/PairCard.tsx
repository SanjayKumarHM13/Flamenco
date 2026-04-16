import React from "react";
import { TickerData, NodeData, PairStat } from "../types";
import { cn } from "../lib/utils";
import { motion } from "motion/react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { Zap, ShieldCheck } from "lucide-react";

interface PairCardProps {
  pairName: string;
  data: TickerData;
  node: NodeData;
  stats: PairStat;
  onTrade: (direction: "Buy" | "Sell") => void;
  onToggleAuto: (enabled: boolean) => void;
}

export const PairCard: React.FC<PairCardProps> = ({
  pairName,
  data,
  node,
  stats,
  onTrade,
  onToggleAuto,
}) => {
  const [autoEnabled, setAutoEnabled] = React.useState(false);

  const handleToggleAuto = () => {
    const newState = !autoEnabled;
    setAutoEnabled(newState);
    onToggleAuto(newState);
  };

  // Prepare p-trend data for sparkline
  const pTrendData = (data.p_trend || []).map((val, i) => ({ val, i }));

  return (
    <div className="hardware-card p-6 flex flex-col h-full relative overflow-hidden group">
      {/* Background Glow based on Signal */}
      <div className={cn(
        "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 transition-colors duration-1000",
        data.sig === "Long" ? "bg-emerald-500" :
        data.sig === "Short" ? "bg-rose-500" : "bg-zinc-500"
      )} />

      {/* Header */}
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold font-mono tracking-tighter">{pairName}</h3>
            <div className={cn(
              "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
              node.status === "Online" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-zinc-500"
            )}>
              {node.status}
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono uppercase">
            {node.host} · Rank {node.role === "Master" ? "0" : "1-3"}
          </p>
        </div>
        <div className="text-right">
          <div className={cn(
            "text-2xl font-bold font-mono tracking-tighter",
            data.z >= 0 ? "text-emerald-400" : "text-rose-400"
          )}>
            {data.z >= 0 ? "+" : ""}{(data.z ?? 0).toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono uppercase">Z-Score</div>
        </div>
      </div>

      {/* AI Sub-Panel: XGBoost Score */}
      <div className="mb-6 relative z-10">
        <div className="flex justify-between items-end mb-2">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">XGBoost Confidence</span>
          </div>
          <span className="text-xs font-mono font-bold text-white">{(data.xgb * 100).toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 relative group/xgb">
          <motion.div 
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
            initial={{ width: 0 }}
            animate={{ width: `${Number(data.xgb) * 100}%` }}
            transition={{ type: "spring", bounce: 0, duration: 1 }}
          />
          {/* Feature Breakdown Tooltip (Simulated on Hover) */}
          <div className="absolute top-full left-0 mt-2 w-full bg-zinc-900 border border-zinc-800 p-2 rounded shadow-xl opacity-0 group-hover/xgb:opacity-100 transition-opacity z-50 pointer-events-none">
            <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Feature Attribution</p>
            <div className="space-y-1">
              {Object.entries(data.features || {}).map(([feat, val]) => (
                <div key={feat} className="flex justify-between items-center text-[9px] font-mono">
                  <span className="text-zinc-400">{feat}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${Number(val) * 100}%` }} />
                    </div>
                    <span className="text-white">{(Number(val) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Sub-Panel: EG p-value & Beta Stability */}
      <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
        <div className="bg-zinc-950/50 p-3 rounded border border-zinc-800/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] text-zinc-500 uppercase font-bold">EG p-value</span>
            <span className={cn(
              "text-[10px] font-mono font-bold",
              (data.p_trend?.[data.p_trend.length-1] ?? 0) < 0.05 ? "text-emerald-400" : "text-amber-400"
            )}>
              {(data.p_trend?.[data.p_trend.length-1] ?? 0).toFixed(3)}
            </span>
          </div>
          <div className="h-8 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pTrendData}>
                <Line 
                  type="monotone" 
                  dataKey="val" 
                  stroke={(data.p_trend?.[data.p_trend.length-1] ?? 0) < 0.05 ? "#10b981" : "#f59e0b"} 
                  strokeWidth={1.5} 
                  dot={false} 
                  isAnimationActive={false}
                />
                <YAxis domain={[0, 0.15]} hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-zinc-950/50 p-3 rounded border border-zinc-800/50 flex flex-col justify-between">
          <span className="text-[9px] text-zinc-500 uppercase font-bold">β Stability</span>
          <div className="flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold font-mono">{(stats.beta ?? 0).toFixed(3)}</span>
              <span className="text-[8px] text-zinc-500 font-mono">Kalman Posterior</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-4 bg-zinc-900 rounded-sm border border-zinc-800 relative overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-1/2 -translate-x-1/2 bg-blue-500/30" 
                  style={{ width: `${Number(data.beta_var ?? 0) * 10000}%`, maxWidth: '100%' }} 
                />
                <div className="absolute inset-y-0 left-1/2 w-px bg-blue-500" />
              </div>
              <span className="text-[8px] text-zinc-600 font-mono mt-1">±Var</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
        <div className="bg-zinc-950/50 p-2.5 rounded border border-zinc-800/50">
          <span className="text-[8px] text-zinc-500 uppercase font-bold block mb-0.5">Spread</span>
          <span className="text-xs font-mono font-bold">{(data.spread ?? 0).toFixed(1)}</span>
        </div>
        <div className="bg-zinc-950/50 p-2.5 rounded border border-zinc-800/50">
          <span className="text-[8px] text-zinc-500 uppercase font-bold block mb-0.5">Half-Life</span>
          <span className="text-xs font-mono font-bold">{stats.halfLife} bars</span>
        </div>
      </div>

      {/* Controls & P&L */}
      <div className="mt-auto pt-6 border-t border-zinc-800 relative z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <span className="text-[8px] text-zinc-500 uppercase font-bold">Pair P&L</span>
            <span className={cn(
              "text-sm font-bold font-mono",
              data.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {data.pnl >= 0 ? "+" : ""}${(data.pnl ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-zinc-500 uppercase font-bold">Trades {stats.trades}</span>
            <span className="text-[10px] font-mono text-zinc-400">Kelly {(data.k ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex gap-1">
            <button 
              onClick={() => onTrade("Buy")}
              className="flex-1 bg-zinc-900 hover:bg-emerald-950/30 border border-zinc-800 hover:border-emerald-500/50 text-zinc-400 hover:text-emerald-400 text-[10px] font-bold py-2 rounded transition-all uppercase tracking-wider"
            >
              Buy
            </button>
            <button 
              onClick={() => onTrade("Sell")}
              className="flex-1 bg-zinc-900 hover:bg-rose-950/30 border border-zinc-800 hover:border-rose-500/50 text-zinc-400 hover:text-rose-400 text-[10px] font-bold py-2 rounded transition-all uppercase tracking-wider"
            >
              Sell
            </button>
          </div>
          <button 
            onClick={handleToggleAuto}
            className={cn(
              "flex items-center justify-center gap-2 text-[10px] font-bold py-2 rounded transition-all uppercase tracking-wider border",
              autoEnabled 
                ? "bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-[0_0_10px_rgba(37,99,235,0.2)]" 
                : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <ShieldCheck className={cn("w-3 h-3", autoEnabled ? "text-blue-400" : "text-zinc-600")} />
            {autoEnabled ? "Auto ON" : "Auto OFF"}
          </button>
        </div>
      </div>
    </div>
  );
};
