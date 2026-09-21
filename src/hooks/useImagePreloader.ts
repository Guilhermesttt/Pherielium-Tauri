import { useEffect } from "react";

export const useImagePreloader = (urls: string[]) => {
  useEffect(() => {
    const uniqueUrls = Array.from(new Set(urls)).slice(0, 12);
    const task = () => uniqueUrls.forEach((url) => {
      if (!url) return;
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    });
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(task);
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(task, 60);
    return () => window.clearTimeout(timer);
  }, [urls]);
};
