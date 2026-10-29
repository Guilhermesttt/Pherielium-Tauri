import { useEffect, useState } from "react";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const SAMPLE_SIZE = 32;
const MIN_PEAK = 110;
const MAX_PEAK = 215;

const saturation = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

/**
 * Cor que representa a capa: a mais frequente entre as vivas. Cinzas e pretos (bordas, fundos) só
 * ganham se a capa inteira for assim. O resultado é limitado em brilho para o texto branco sempre
 * ter contraste, mesmo em capas muito claras ou muito escuras. `null` = imagem sem pixels úteis.
 */
export function pickDominantColor(data: Uint8ClampedArray | number[]): Rgb | null {
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number; count: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const weight = 0.25 + saturation(r, g, b);
    const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0, count: 0 };
    bucket.weight += weight;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  let best: { weight: number; r: number; g: number; b: number; count: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.weight > best.weight) best = bucket;
  }
  if (!best) return null;

  let r = best.r / best.count;
  let g = best.g / best.count;
  let b = best.b / best.count;
  const peak = Math.max(r, g, b);
  const scale = peak < MIN_PEAK ? MIN_PEAK / Math.max(peak, 1) : peak > MAX_PEAK ? MAX_PEAK / peak : 1;
  r = Math.min(255, r * scale);
  g = Math.min(255, g * scale);
  b = Math.min(255, b * scale);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

export const rgbString = ({ r, g, b }: Rgb) => `${r}, ${g}, ${b}`;

const colorCache = new Map<string, Rgb | null>();

function sampleImage(url: string): Promise<Rgb | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        resolve(pickDominantColor(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data));
      } catch {
        // imagem de outra origem "suja" o canvas: sem cor, o cartão usa o tom padrão
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Cor dominante da capa como "r, g, b" (pronta para `rgba(...)`), ou `null` enquanto não há. */
export function useCoverColor(url: string): string | null {
  const [color, setColor] = useState<{ url: string; rgb: Rgb | null } | null>(null);

  useEffect(() => {
    if (!url) return;
    if (colorCache.has(url)) {
      setColor({ url, rgb: colorCache.get(url) ?? null });
      return;
    }
    let cancelled = false;
    void sampleImage(url).then((rgb) => {
      if (colorCache.size > 30) colorCache.delete(colorCache.keys().next().value as string);
      colorCache.set(url, rgb);
      if (!cancelled) setColor({ url, rgb });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return color && color.url === url && color.rgb ? rgbString(color.rgb) : null;
}
