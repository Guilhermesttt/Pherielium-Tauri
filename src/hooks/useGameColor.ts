import { useState, useEffect } from 'react';
import { FastAverageColor } from 'fast-average-color';

const fac = new FastAverageColor();
const colorCache = new Map<string, { hex: string; isDark: boolean }>();
const COLOR_CACHE_MAX = 200;

/** Clamps luminance for extracted cover color so bright/pastel artwork doesn't wash out contrast */
function clampColorLuminance(r: number, g: number, b: number): string {
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  if (luminance > 180) {
    // Escurece suavemente para preservar o tom sem estourar contraste
    const factor = 180 / luminance;
    const clampedR = Math.round(r * factor);
    const clampedG = Math.round(g * factor);
    const clampedB = Math.round(b * factor);
    return `rgb(${clampedR}, ${clampedG}, ${clampedB})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export const useGameColor = (imageUrl?: string) => {
  const [color, setColor] = useState({ hex: 'rgba(255,255,255,1)', isDark: false });

  useEffect(() => {
    if (!imageUrl) {
      setColor({ hex: 'rgba(255,255,255,1)', isDark: false });
      return;
    }

    const cached = colorCache.get(imageUrl);
    if (cached) { setColor(cached); return; }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    const handleLoad = () => {
      try {
        const extracted = fac.getColor(img);
        const clampedHex = clampColorLuminance(
          extracted.value[0],
          extracted.value[1],
          extracted.value[2],
        );
        const result = { hex: clampedHex, isDark: extracted.isDark };
        colorCache.set(imageUrl, result);
        if (colorCache.size > COLOR_CACHE_MAX) {
          const oldestKey = colorCache.keys().next().value;
          if (oldestKey !== undefined) colorCache.delete(oldestKey);
        }
        setColor(result);
      } catch {
        setColor({ hex: '#ffffff', isDark: false });
      }
    };

    const handleError = () => {
      setColor({ hex: '#ffffff', isDark: false });
    };

    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);

    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  }, [imageUrl]);

  return color;
};
