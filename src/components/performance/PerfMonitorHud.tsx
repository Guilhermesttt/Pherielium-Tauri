import React from "react";

interface PerfMonitorHudProps {
  fps: number;
  cpu: number;
  ramPercent: number;
  className?: string;
}

export const PerfMonitorHud: React.FC<PerfMonitorHudProps> = ({
  fps,
  cpu,
  ramPercent,
  className = "",
}) => {
  return (
    <div className={`overlay-perf-hud ${className}`.trim()} aria-hidden>
      <span>{Math.round(fps)} FPS</span>
      <span className="opacity-40">·</span>
      <span>CPU {Math.round(cpu)}%</span>
      <span className="opacity-40">·</span>
      <span>RAM {Math.round(ramPercent)}%</span>
    </div>
  );
};

export default PerfMonitorHud;
