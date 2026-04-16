import React from "react";
import { Card } from "./ui/card";
import { TrendingUp, Target, Zap, Shield } from "lucide-react";
import { cn } from "../lib/utils";

interface KpiProps {
  pnl: number;
  pos: number;
  winRate: number;
  drawdown: number;
}

export const KpiGrid: React.FC<KpiProps> = ({ pnl, pos, winRate, drawdown }) => {
  const kpis = [
    { 
      label: "Total P&L", 
      value: `$${pnl.toFixed(2)}`, 
      icon: TrendingUp, 
      color: pnl >= 0 ? "text-emerald-400" : "text-rose-400",
      bg: pnl >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
    },
    { 
      label: "Win Rate", 
      value: `${winRate}%`, 
      icon: Target, 
      color: "text-blue-400",
      bg: "bg-blue-500/10"
    },
    { 
      label: "Active Positions", 
      value: pos, 
      icon: Zap, 
      color: "text-amber-400",
      bg: "bg-amber-500/10"
    },
    { 
      label: "Max Drawdown", 
      value: `${drawdown}%`, 
      icon: Shield, 
      color: "text-zinc-400",
      bg: "bg-zinc-500/10"
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => (
        <Card key={i} className="bg-zinc-900/50 border-zinc-800 p-4 flex items-center gap-4">
          <div className={cn("p-2 rounded-lg", kpi.bg)}>
            <kpi.icon className={cn("w-5 h-5", kpi.color)} />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{kpi.label}</p>
            <p className={cn("text-lg font-black font-mono", kpi.color)}>{kpi.value}</p>
          </div>
        </Card>
      ))}
    </div>
  );
};
