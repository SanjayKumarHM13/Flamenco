import React from "react";
import { NodeData } from "../types";
import { cn } from "../lib/utils";
import { Network } from "lucide-react";

interface MpiTopologyProps {
  nodes: Record<string, NodeData>;
}

export const MpiTopology: React.FC<MpiTopologyProps> = ({ nodes }) => {
  return (
    <div className="hardware-card p-6 flex flex-col h-[300px]">
      <div className="flex items-center gap-2 mb-4">
        <Network className="w-4 h-4 text-zinc-500" />
        <h3 className="hardware-label">MPI Cluster Status</h3>
      </div>
      <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.entries(nodes) as [string, NodeData][]).map(([rankId, node]) => (
          <div key={rankId} className="bg-zinc-950/50 border border-zinc-800/50 p-3 rounded flex justify-between items-center">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[10px] font-mono">{rankId}</span>
                <div className={cn("w-1.5 h-1.5 rounded-full", node.status === "Online" ? "bg-emerald-500 shadow-[0_0_5px_#10b981]" : "bg-zinc-600")} />
              </div>
              <p className="text-[9px] text-zinc-500 font-mono uppercase">{node.role} {node.pair ? `· ${node.pair}` : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-zinc-400 font-mono">{node.cpu}% CPU</p>
              <p className="text-[9px] text-zinc-500 font-mono">{node.ram}MB</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
