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
    // Só a hora, em texto: o verde "ao vivo" é reservado para estado real (jogo em execução, amigo online).
    <time className="font-metric whitespace-nowrap px-[var(--space-2,0.5rem)] text-[length:var(--fs-caption)] font-medium text-[var(--ink-muted)] select-none">
      {time}
    </time>
  );
};

export default TopBarClock;
