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
    <div className="ctl-pill gap-[var(--gap-stack)] px-[var(--space-4)] select-none">
      <span className="h-[0.5em] w-[0.5em] rounded-full bg-emerald-400 animate-pulse text-[length:var(--fs-caption)]" />
      <span className="font-mono text-[length:var(--fs-caption)] font-semibold tracking-wider text-white/80">
        {time}
      </span>
    </div>
  );
};

export default TopBarClock;
