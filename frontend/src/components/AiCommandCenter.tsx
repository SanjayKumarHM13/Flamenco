import React from "react";
import { motion } from "motion/react";
import { RegimeState, LstmData, MetaModelAllocation } from "../types";
import { cn } from "../lib/utils";
import { Brain, Cpu, Layers, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface AiCommandCenterProps {
  lstm: LstmData;
  metaAllocations: MetaModelAllocation[];
}

export const AiCommandCenter: React.FC<AiCommandCenterProps> = ({ lstm, metaAllocations }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
      {/* LSTM Regime Dial */}
      <div className="lg:col-span-3 hardware-card p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <Brain className="w-4 h-4 text-blue-500" />
          <span className="hardware-label">Master LSTM</span>
        </div>
        
        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="8"
              className="text-zinc-800"
            />
            <motion.circle
              cx="80"
              cy="80"
              r="70"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={440}
              initial={{ strokeDashoffset: 440 }}
              animate={{ strokeDashoffset: 440 - (440 * lstm.confidence) }}
              className={cn(
                lstm.regime === "MEAN_REVERTING" ? "text-emerald-500" :
                lstm.regime === "TRENDING" ? "text-amber-500" : "text-rose-500"
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Regime</span>
            <span className={cn(
              "text-sm font-bold font-mono leading-tight",
              lstm.regime === "MEAN_REVERTING" ? "text-emerald-400" :
              lstm.regime === "TRENDING" ? "text-amber-400" : "text-rose-400"
            )}>
              {lstm.regime.replace("_", " ")}
            </span>
            <span className="text-xs text-zinc-500 mt-1">{(lstm.confidence * 100).toFixed(0)}% Conf</span>
          </div>
        </div>
      </div>

      {/* Sequence Heatmap */}
      <div className="lg:col-span-6 hardware-card p-6 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span className="hardware-label">60-Bar Feature Sequence</span>
          </div>
          <div className="flex gap-2">
            {["Z", "B", "V", "P", "H", "S", "K"].map(f => (
              <span key={f} className="text-[8px] font-mono text-zinc-600 w-4 text-center">{f}</span>
            ))}
          </div>
        </div>
        
        <div 
          className="flex-1 grid gap-px bg-zinc-900 border border-zinc-800 overflow-hidden rounded-sm"
          style={{ gridTemplateColumns: 'repeat(60, minmax(0, 1fr))' }}
        >
          {lstm.heatmap.map((row, rIdx) => (
            <React.Fragment key={rIdx}>
              {row.map((val, cIdx) => (
                <div 
                  key={`${rIdx}-${cIdx}`}
                  className="w-full h-full"
                  style={{ 
                    backgroundColor: `rgba(59, 130, 246, ${val * 0.8})`,
                    opacity: 0.3 + (val * 0.7)
                  }}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[8px] font-mono text-zinc-600 uppercase">
          <span>T-60</span>
          <span>Rolling Memory Window</span>
          <span>Now</span>
        </div>
      </div>

      {/* Meta-Model Output */}
      <div className="lg:col-span-3 hardware-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-blue-500" />
          <span className="hardware-label">Meta-Model Allocator</span>
        </div>
        
        <div className="space-y-3">
          {metaAllocations.map((alloc, i) => (
            <div key={`${alloc.pair}-${i}`} className="flex items-center justify-between p-2 bg-zinc-950/50 border border-zinc-800/50 rounded">
              <div className="flex flex-col">
                <span className="text-xs font-bold font-mono">{alloc.pair}</span>
                <span className="text-[10px] text-zinc-500 font-mono">{(alloc.prob * 100).toFixed(0)}% Prob</span>
              </div>
              <div className="flex flex-col items-end">
                <div className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase mb-1",
                  alloc.allocated ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-zinc-500"
                )}>
                  {alloc.allocated ? "Allocated" : "Suppressed"}
                </div>
                <span className="text-[10px] font-mono text-zinc-400">K: {alloc.kelly.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
