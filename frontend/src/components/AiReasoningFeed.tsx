import React from "react";
import { LogEventData } from "../types";
import { cn } from "../lib/utils";
import { Brain, Zap, Shield, Terminal } from "lucide-react";

interface AiReasoningFeedProps {
  logs: LogEventData[];
}

export const AiReasoningFeed: React.FC<AiReasoningFeedProps> = ({ logs }) => {
  return (
    <div className="hardware-card h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-500" />
          <span className="hardware-label">AI Decision Flow</span>
        </div>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/20" />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[10px]">
        {logs.map((log) => (
          <div key={`${log.t}-${log.msg}`} className="flex gap-3 group">
            <span className="text-zinc-600 shrink-0">
              {new Date(log.t).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {log.type === "ai" && <Brain className="w-3 h-3 text-blue-400" />}
                {log.type === "trade" && <Zap className="w-3 h-3 text-amber-400" />}
                {log.type === "system" && <Shield className="w-3 h-3 text-zinc-400" />}
                <span className={cn(
                  "font-bold uppercase tracking-tighter",
                  log.type === "ai" ? "text-blue-400" :
                  log.type === "trade" ? "text-amber-400" : "text-zinc-400"
                )}>
                  {log.type}
                </span>
              </div>
              <p className="text-zinc-300 leading-relaxed group-hover:text-white transition-colors">
                {log.msg}
              </p>
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="h-full flex items-center justify-center text-zinc-600 italic">
            Awaiting AI reasoning...
          </div>
        )}
      </div>
    </div>
  );
};
