import { useEffect, useRef } from "react";

interface UseIntervalOptions {
  pauseWhenHidden?: boolean;
}

export function useInterval(
  callback: () => void,
  delay: number | null,
  options?: UseIntervalOptions
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    let id: number | null = null;

    const tick = () => {
      savedCallback.current();
    };

    const start = () => {
      if (id === null) {
        id = window.setInterval(tick, delay);
      }
    };

    const stop = () => {
      if (id !== null) {
        window.clearInterval(id);
        id = null;
      }
    };

    const handleVisibilityChange = () => {
      if (!options?.pauseWhenHidden) return;
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        start();
      }
    };

    if (!options?.pauseWhenHidden || document.visibilityState !== "hidden") {
      start();
    }

    if (options?.pauseWhenHidden) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stop();
      if (options?.pauseWhenHidden) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [delay, options?.pauseWhenHidden]);
}
