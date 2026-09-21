import { useEffect, useMemo, useRef, useState } from "react";

interface AdaptiveGridOptions {
  count: number;
  aspectRatio: number; // width / height target per tile
  gap: number;
  minTileWidth?: number;
  maxTileWidth?: number;
  padding?: number;
}

interface AdaptiveGridResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  isMeasured: boolean;
}

/**
 * Computes the Discord-style "best fit" grid for N tiles inside a container:
 * for every possible column count, it works out the tile size that would result,
 * then keeps the arrangement that yields the largest tile area without overflowing
 * the container. Re-runs whenever the container resizes or the participant count
 * changes, so the grid reflows live as people join or leave.
 */
export function useAdaptiveGrid({
  count,
  aspectRatio,
  gap,
  minTileWidth = 120,
  maxTileWidth = 520,
  padding = 0,
}: AdaptiveGridOptions): AdaptiveGridResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return useMemo(() => {
    const availableW = Math.max(0, size.width - padding * 2);
    const availableH = Math.max(0, size.height - padding * 2);
    const safeCount = Math.max(1, count);

    if (availableW === 0 || availableH === 0) {
      return {
        containerRef,
        columns: safeCount,
        rows: 1,
        tileWidth: minTileWidth,
        tileHeight: minTileWidth / aspectRatio,
        isMeasured: false,
      };
    }

    let best = { cols: 1, rows: safeCount, tileW: 0, tileH: 0 };

    for (let cols = 1; cols <= safeCount; cols += 1) {
      const rows = Math.ceil(safeCount / cols);
      const rawTileW = (availableW - gap * (cols - 1)) / cols;
      if (rawTileW <= 0) continue;
      const rawTileH = rawTileW / aspectRatio;
      const totalH = rawTileH * rows + gap * (rows - 1);

      const scale = totalH > availableH ? availableH / totalH : 1;
      const tileW = Math.min(rawTileW * scale, maxTileWidth);
      const tileH = tileW / aspectRatio;

      if (tileW > best.tileW) {
        best = { cols, rows, tileW, tileH };
      }
    }

    return {
      containerRef,
      columns: best.cols,
      rows: best.rows,
      tileWidth: Math.max(best.tileW, minTileWidth),
      tileHeight: Math.max(best.tileH, minTileWidth / aspectRatio),
      isMeasured: true,
    };
  }, [size.width, size.height, count, aspectRatio, gap, minTileWidth, maxTileWidth, padding]);
}
