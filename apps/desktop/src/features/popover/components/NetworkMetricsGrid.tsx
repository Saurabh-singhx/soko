import React from 'react';
import { Battery } from 'lucide-react';

interface NetworkMetricsGridProps {
  pingMs?: number;
  rssi?: number;
  batteryLevel?: number;
}

export const NetworkMetricsGrid: React.FC<NetworkMetricsGridProps> = ({
  pingMs = 8,
  rssi = -45,
  batteryLevel = 95,
}) => {
  return (
    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/[0.06] text-[10px] font-mono text-neutral-300">
      <div className="flex flex-col items-center justify-center bg-black/30 p-1.5 rounded-lg border border-white/[0.05]">
        <span className="text-[9px] text-neutral-500">PING</span>
        <span className="text-white font-medium">{pingMs} ms</span>
      </div>
      <div className="flex flex-col items-center justify-center bg-black/30 p-1.5 rounded-lg border border-white/[0.05]">
        <span className="text-[9px] text-neutral-500">SIGNAL</span>
        <span className="text-white font-medium">{rssi} dBm</span>
      </div>
      <div className="flex flex-col items-center justify-center bg-black/30 p-1.5 rounded-lg border border-white/[0.05]">
        <span className="text-[9px] text-neutral-500">BATTERY</span>
        <span className="text-white font-medium flex items-center gap-1">
          <Battery size={11} className="text-emerald-400" /> {batteryLevel}%
        </span>
      </div>
    </div>
  );
};
