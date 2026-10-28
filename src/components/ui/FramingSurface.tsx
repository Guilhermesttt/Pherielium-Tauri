import React, { useEffect, useRef, useState } from "react";
import { Move } from "lucide-react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampFraming,
  framedRect,
  panFraming,
  type Framing,
  type Size,
} from "../../services/mediaFraming";

export interface FramingSurfaceProps {
  /** URL da mídia, sem o enquadramento guardado nela. */
  src: string;
  framing: Framing;
  onChange: (framing: Framing) => void;
  /** Formato e cantos da moldura (ex.: `aspect-[5/1] w-full rounded-[var(--corner-md)]`). */
  className?: string;
  label?: string;
}

const ARROW_STEP_PX = 12;
const WHEEL_ZOOM_PER_PX = 0.0015;

/**
 * A moldura em que a pessoa arrasta a imagem direto, para cima, para baixo e para os lados, até
 * ficar como quer; a roda do mouse aproxima e afasta, e as setas do teclado também movem. A imagem não
 * é recortada (um GIF continua animado): só o enquadramento muda, via `onChange`.
 */
export const FramingSurface: React.FC<FramingSurfaceProps> = ({ src, framing, onChange, className = "", label = "Enquadramento" }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Size | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const latest = useRef({ framing, frame, natural, onChange });
  latest.current = { framing, frame, natural, onChange };

  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setFrame({ w: el.clientWidth, h: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // com o zoom ou a moldura mudando, o ponto central pode ficar fora do alcance: traz de volta
  useEffect(() => {
    if (!frame || !natural) return;
    const next = clampFraming(frame, natural, framing);
    if (next.x !== framing.x || next.y !== framing.y || next.zoom !== framing.zoom) onChange(next);
  }, [frame, natural, framing, onChange]);

  // trocar de janela no meio do arraste não pode deixar a imagem "presa" na mão
  useEffect(() => {
    const stop = () => {
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener("blur", stop);
    return () => window.removeEventListener("blur", stop);
  }, []);

  // a roda precisa de listener não passivo para não rolar o modal junto
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const { framing: f, frame: fr, natural: n, onChange: change } = latest.current;
      if (!fr || !n) return;
      event.preventDefault();
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, f.zoom * (1 - event.deltaY * WHEEL_ZOOM_PER_PX)));
      change(clampFraming(fr, n, { ...f, zoom }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const move = (dx: number, dy: number) => {
    if (!frame || !natural) return;
    onChange(panFraming(framing, dx, dy, frame, natural));
  };

  const rect = frame && natural ? framedRect(frame, natural, framing) : null;

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label={`${label}: arraste a imagem para posicionar`}
      tabIndex={0}
      onPointerDown={(event) => {
        // um segundo dedo ou ponteiro não rouba o arraste em andamento
        if (drag.current) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerMove={(event) => {
        if (!drag.current || drag.current.id !== event.pointerId) return;
        const dx = event.clientX - drag.current.x;
        const dy = event.clientY - drag.current.y;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        move(dx, dy);
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? ARROW_STEP_PX * 4 : ARROW_STEP_PX;
        const delta: Record<string, [number, number]> = {
          // a seta anda a janela sobre a imagem: a imagem vai no sentido contrário
          ArrowLeft: [step, 0],
          ArrowRight: [-step, 0],
          ArrowUp: [0, step],
          ArrowDown: [0, -step],
        };
        const d = delta[event.key];
        if (!d) return;
        event.preventDefault();
        move(d[0], d[1]);
      }}
      className={`relative touch-none select-none overflow-hidden bg-[var(--tone-3)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      } ${className}`}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        onLoad={(event) => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
        className="pointer-events-none"
        style={
          rect
            ? { position: "absolute", left: rect.left, top: rect.top, width: rect.width, height: rect.height, maxWidth: "none" }
            : { width: "100%", height: "100%", objectFit: "cover" }
        }
      />
      {natural && !dragging && (
        <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-[10px] bg-[color-mix(in_srgb,var(--tone-0)_72%,transparent)] px-2.5 py-1.5 text-[length:var(--step-0)] text-[var(--ink-muted)]">
          <Move className="h-3.5 w-3.5" aria-hidden /> Arraste · role para aproximar
        </span>
      )}
    </div>
  );
};
