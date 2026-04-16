import React from "react";
import { LogEventData } from "../types";
import { cn } from "../lib/utils";
import { ListFilter } from "lucide-react";

interface SignalLogProps {
  logs: LogEventData[];
}

export const SignalLog: React.FC<SignalLogProps> = ({ logs }) => {
  return (
    <div className="hardware-card p-6 overflow-hidden flex flex-col h-[300px]">
      <div className="flex items-center gap-2 mb-4">
        <ListFilter className="w-4 h-4 text-zinc-500" />
        <h3 className="hardware-label">Signal History</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left font-mono text-[10px]">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-tighter sticky top-0 bg-zinc-950">
              <th className="pb-2 font-medium">Time</th>
              <th className="pb-2 font-medium">Event</th>
              <th className="pb-2 font-medium text-right">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {logs.map((log) => (
              <tr key={`${log.t}-${log.msg}`} className="hover:bg-zinc-800/30 transition-colors">
                <td className="py-2 text-zinc-500">
                  {new Date(log.t).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="py-2 font-medium text-zinc-300 truncate max-w-[200px]">{log.msg}</td>
                <td className="py-2 text-right">
                  <span className={cn(
                    "px-1 rounded-[2px] font-bold uppercase text-[8px]",
                    log.type === "ai" ? "text-blue-400 bg-blue-400/10" :
                    log.type === "trade" ? "text-amber-400 bg-amber-400/10" : "text-zinc-500 bg-zinc-500/10"
                  )}>
                    {log.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
