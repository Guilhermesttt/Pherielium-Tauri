/**
 * Enquadramento de foto e banner de perfil, sem recortar o arquivo.
 *
 * Um GIF não pode ser recortado no canvas (sobraria só o primeiro quadro), então o enquadramento
 * é guardado à parte e aplicado na hora de mostrar. Ele viaja no fim da própria URL da mídia
 * (`...avatar.gif#pf=50,30,1.4`): o servidor e o navegador ignoram o fragmento, então a coluna
 * `photo_url`/`banner_url` continua sendo só uma URL e nenhuma migration é preciso. Telas que não
 * conhecem o enquadramento mostram a imagem centralizada, como antes.
 */

export interface Framing {
  /** Ponto da imagem (0–100, em % da largura) que fica no centro da moldura. */
  x: number;
  /** Idem, em % da altura. */
  y: number;
  /** 1 = a imagem apenas cobre a moldura; maior aproxima. */
  zoom: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const DEFAULT_FRAMING: Framing = { x: 50, y: 50, zoom: 1 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

const PARAM = "pf";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const isDefaultFraming = (framing: Framing): boolean =>
  framing.x === DEFAULT_FRAMING.x && framing.y === DEFAULT_FRAMING.y && framing.zoom === DEFAULT_FRAMING.zoom;

/** A URL sem o fragmento de enquadramento. */
export function stripFraming(url: string): string {
  const hash = url.indexOf("#");
  return hash === -1 ? url : url.slice(0, hash);
}

/** Separa a URL da mídia do enquadramento guardado nela; o que não for válido vira o padrão. */
export function parseFraming(url: string): { src: string; framing: Framing } {
  const hash = url.indexOf("#");
  if (hash === -1) return { src: url, framing: DEFAULT_FRAMING };
  const value = new URLSearchParams(url.slice(hash + 1)).get(PARAM);
  const parts = value?.split(",").map(Number) ?? [];
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return { src: url.slice(0, hash), framing: DEFAULT_FRAMING };
  }
  const [x, y, zoom] = parts;
  return {
    src: url.slice(0, hash),
    framing: { x: clamp(x, 0, 100), y: clamp(y, 0, 100), zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) },
  };
}

/** Guarda o enquadramento na URL; o padrão não escreve nada. Data URLs ficam como estão. */
export function withFraming(url: string, framing: Framing): string {
  const src = stripFraming(url);
  if (!src || src.startsWith("data:") || isDefaultFraming(framing)) return src;
  const round = (n: number, digits: number) => Number(n.toFixed(digits));
  return `${src}#${PARAM}=${round(framing.x, 1)},${round(framing.y, 1)},${round(framing.zoom, 2)}`;
}

const coverScale = (frame: Size, natural: Size) => Math.max(frame.w / natural.w, frame.h / natural.h);

/** Onde a imagem fica dentro da moldura: o ponto escolhido no centro, sem nunca deixar borda vazia. */
export function framedRect(frame: Size, natural: Size, framing: Framing): Rect {
  const scale = coverScale(frame, natural) * framing.zoom;
  const width = natural.w * scale;
  const height = natural.h * scale;
  return {
    left: clamp(frame.w / 2 - (framing.x / 100) * width, frame.w - width, 0),
    top: clamp(frame.h / 2 - (framing.y / 100) * height, frame.h - height, 0),
    width,
    height,
  };
}

/** Limita o ponto central ao que a moldura consegue mostrar com o zoom atual. */
export function clampFraming(frame: Size, natural: Size, framing: Framing): Framing {
  const zoom = clamp(framing.zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = coverScale(frame, natural) * zoom;
  const halfX = (frame.w / 2 / (natural.w * scale)) * 100;
  const halfY = (frame.h / 2 / (natural.h * scale)) * 100;
  return {
    zoom,
    x: clamp(framing.x, halfX, 100 - halfX),
    y: clamp(framing.y, halfY, 100 - halfY),
  };
}

/** Arrastar a imagem `dx`/`dy` pixels na moldura: o ponto central anda no sentido contrário. */
export function panFraming(framing: Framing, dx: number, dy: number, frame: Size, natural: Size): Framing {
  const scale = coverScale(frame, natural) * framing.zoom;
  return clampFraming(frame, natural, {
    ...framing,
    x: framing.x - (dx / (natural.w * scale)) * 100,
    y: framing.y - (dy / (natural.h * scale)) * 100,
  });
}
