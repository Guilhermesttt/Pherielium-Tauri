import { useEffect, useState } from "react";
import {
  loadOverlayPrefs,
  loadSystemPerfSnapshot,
  onOverlayPrefsChanged,
  type SystemPerfSnapshot,
} from "../lib/overlayPrefs";

export function formatRamGb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 GB";
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function usePerfMonitor(options?: { sample?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [fps, setFps] = useState(0);
  const [snapshot, setSnapshot] = useState<SystemPerfSnapshot | null>(null);
  const sample = enabled || Boolean(options?.sample);

  useEffect(() => {
    let cancelled = false;
    void loadOverlayPrefs().then((prefs) => {
      if (!cancelled) setEnabled(prefs.perfMonitor);
    });
    const stop = onOverlayPrefsChanged((prefs) => setEnabled(prefs.perfMonitor));
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  useEffect(() => {
    if (!sample) return;
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        setFps(frames);
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sample]);

  useEffect(() => {
    if (!sample) return;
    let cancelled = false;
    const poll = async () => {
      const next = await loadSystemPerfSnapshot();
      if (!cancelled && next) setSnapshot(next);
    };
    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sample]);

  return {
    enabled,
    fps,
    cpu: snapshot?.cpu ?? 0,
    ramPercent: snapshot?.ramPercent ?? 0,
    ramUsed: snapshot?.ramUsed ?? 0,
    ramTotal: snapshot?.ramTotal ?? 0,
  };
}
