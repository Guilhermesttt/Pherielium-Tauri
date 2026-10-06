import React, { useState, useEffect } from "react";

export const TopBarClock: React.FC = () => {
  const [time, setTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  });

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121212]/80 border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span className="font-mono text-xs font-semibold tracking-wider text-white/80">
        {time}
      </span>
    </div>
  );
};

export default TopBarClock;
