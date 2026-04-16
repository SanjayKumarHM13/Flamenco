import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { EquityPoint } from "../types";

interface EquityChartProps {
  data: EquityPoint[];
}

export const EquityChart: React.FC<EquityChartProps> = ({ data }) => {
  return (
    <div className="w-full h-[300px] bg-zinc-900/50 rounded-xl border border-zinc-800 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Portfolio Equity Curve</h3>
        <div className="text-xs font-mono text-emerald-400">
          Current: ${data[data.length - 1]?.balance.toLocaleString()}
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis 
            dataKey="t" 
            hide 
          />
          <YAxis 
            domain={['auto', 'auto']} 
            stroke="#52525b" 
            fontSize={10} 
            tickFormatter={(val) => `$${val}`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '12px' }}
            labelStyle={{ display: 'none' }}
            formatter={(val: number) => [`$${val.toFixed(2)}`, 'Balance']}
          />
          <Area 
            type="monotone" 
            dataKey="balance" 
            stroke="#10b981" 
            fillOpacity={1} 
            fill="url(#colorBalance)" 
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
