import React, { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BotEngine, type BotFrame, type Look } from "./engine/engine";
import { clamp } from "./engine/math";
import { DEMI_VIEWBOX, RAYON } from "./engine/repere";
import { SHAPE_BY_ID, mixHex } from "./engine/skins";
import { STATE_BY_ID } from "./engine/states";
import { mouthPlacement, mouthShape, matrixTranslation, smoothLevel } from "./mouth";
import type { MascotMood } from "./moods";
import { MOOD_SPECS, resolveExpression, type BounceKind } from "./pherieStates";
import { subscribeTicker } from "./ticker";

export interface MascotPointer {
  x: number;
  y: number;
  /** Date.now() do último movimento — após ~4s o olhar volta ao humor. */
  t: number;
}

export interface MascotViewProps {
  mood?: MascotMood;
  size?: number;
  /** Cor dos olhos/boca (a cor do mascote nas configs). */
  color?: string;
  /** Volume da voz 0..1 (estado do React). Para volume ao vivo sem re-render use `levelRef`. */
  level?: number;
  levelRef?: { current: number };
  /** Sem `level`/`levelRef`, falando = boca oscilando sozinha. */
  isSpeaking?: boolean;
  /** Em chamada: fone com haste de microfone, independente do humor. */
  inCall?: boolean;
  isMusicPlaying?: boolean;
  isHovered?: boolean;
  /** Cursor global (coordenadas client); os olhos/cabeça seguem. */
  pointer?: MascotPointer | null;
  paused?: boolean;
  className?: string;
  onClick?: () => void;
}

const VB = DEMI_VIEWBOX;
const SHAPE = SHAPE_BY_ID.get("squircle")?.radii ?? null;
const POINTER_IDLE_MS = 4000;

/** Balanço do corpo por humor (carregado do mascote antigo, aplicado ao wrapper). */
function bounceAnimation(bounce: BounceKind, poked: boolean, speaking: boolean) {
  const animate = poked
    ? { y: [0, -6, 0], rotate: [0, -8, 8, 0] }
    : speaking
    ? { scale: [1, 1.05, 1] }
    : bounce === "bouncy"
    ? { y: [0, -3.5, -1, -2.5, 0], rotate: [-6, 6, -4, 4, 0] }
    : bounce === "tremble"
    ? { x: [0, -0.8, 0.8, 0] }
    : bounce === "sway"
    ? { rotate: [-3, 3, -3] }
    : bounce === "wobble"
    ? { rotate: [-14, 14, -10, 10, 0], y: [0, -2, 0, -2, 0] }
    : { y: [0, -1, 0] };
  const transition = poked
    ? { type: "spring" as const, stiffness: 450, damping: 14 }
    : speaking
    ? { repeat: Infinity, duration: 0.28, ease: "easeInOut" as const }
    : bounce === "bouncy"
    ? { repeat: Infinity, duration: 0.9, ease: "easeInOut" as const }
    : bounce === "tremble"
    ? { repeat: Infinity, duration: 0.32, ease: "easeInOut" as const }
    : bounce === "sway"
    ? { repeat: Infinity, duration: 2.8, ease: "easeInOut" as const }
    : bounce === "wobble"
    ? { repeat: Infinity, duration: 1.1, ease: "easeInOut" as const }
    : { repeat: Infinity, duration: 3.5, ease: "easeInOut" as const };
  return { animate, transition };
}

/** Decoração do engine (anéis, partículas) como markup — só aparece em estados especiais (ex.: tonto). */
function decorMarkup(f: BotFrame, uid: string, paper: string, ink: string) {
  let defs = "";
  let back = "";
  let front = "";
  for (const arc of f.arcs) {
    const g = arc.grad;
    const stops = g.stops
      .map((c, i) => `<stop offset="${i / Math.max(1, g.stops.length - 1)}" stop-color="${c}"/>`)
      .join("");
    defs += `<linearGradient id="${uid}-${arc.id}" gradientUnits="userSpaceOnUse" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">${stops}</linearGradient>`;
    const attrs = `fill="none" stroke="url(#${uid}-${arc.id})" stroke-width="${arc.width}" stroke-linecap="round" opacity="${arc.opacity}"`;
    back += `<path d="${arc.back}" ${attrs}/>`;
    front += `<path d="${arc.front}" ${attrs}/>`;
  }
  let dots = "";
  for (const dot of f.dots) {
    const fill = dot.color ?? (dot.depth === undefined ? ink : mixHex(paper, ink, dot.depth));
    dots += dot.d
      ? `<path d="${dot.d}" transform="translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})" fill="${fill}" opacity="${dot.opacity}"/>`
      : `<circle cx="${dot.x}" cy="${dot.y}" r="${dot.r}" fill="${fill}" opacity="${dot.opacity}"/>`;
  }
  return { defs, back, behind: f.dotsBehind ? dots : "", front: f.dotsBehind ? "" : dots, arcsFront: front };
}

export const MascotView: React.FC<MascotViewProps> = (props) => {
  const {
    mood = "idle",
    size = 32,
    color = "#FFFFFF",
    isSpeaking = false,
    inCall = false,
    isMusicPlaying = false,
    isHovered = false,
    className = "",
    onClick,
  } = props;

  // ── humor efetivo (prioridade: interação > saudação > hover > chamada > música > humor) ──
  const [poked, setPoked] = useState(true);
  const [squish, setSquish] = useState(false);
  const [moodOverride, setMoodOverride] = useState<MascotMood | null>(null);
  const clicksRef = useRef<number[]>([]);
  const interactGen = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const t = setTimeout(() => setPoked(false), 650);
    timers.current.push(t);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const effectiveMood: MascotMood =
    moodOverride ??
    (poked
      ? "happy"
      : isHovered && mood === "sleeping"
      ? "idle"
      : isHovered && mood === "idle"
      ? "happy"
      : mood === "calling"
      ? "calling"
      : isMusicPlaying
      ? "music"
      : mood);
  const spec = MOOD_SPECS[effectiveMood] ?? MOOD_SPECS.idle;
  const showHeadphones = inCall || Boolean(spec.headphones) || isMusicPlaying;
  const showMic = inCall || effectiveMood === "calling";
  const speakingNow = isSpeaking || (props.level ?? 0) > 0.06;

  const flashMood = (m: MascotMood, ms: number) => {
    const gen = ++interactGen.current;
    setMoodOverride(m);
    timers.current.push(
      setTimeout(() => {
        if (interactGen.current === gen) setMoodOverride(null);
      }, ms),
    );
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const recent = [...clicksRef.current.filter((t) => now - t < 800), now];
    clicksRef.current = recent;
    setSquish(true);
    timers.current.push(setTimeout(() => setSquish(false), 200));
    if (recent.length >= 3) {
      clicksRef.current = [];
      flashMood("dizzy", 3000);
    } else {
      flashMood("annoyed", 1500);
    }
    onClick?.();
  };

  // ── engine + loop imperativo ──
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const maskBody = useRef<SVGPathElement>(null);
  const maskEyes = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const paperPath = useRef<SVGPathElement>(null);
  const rimPath = useRef<SVGPathElement>(null);
  const bodyGroup = useRef<SVGGElement>(null);
  const faceGroup = useRef<SVGGElement>(null);
  const mouthPathRef = useRef<SVGPathElement>(null);
  const cheeks = [useRef<SVGEllipseElement>(null), useRef<SVGEllipseElement>(null)];
  const decorDefs = useRef<SVGDefsElement>(null);
  const decorBack = useRef<SVGGElement>(null);
  const decorBehind = useRef<SVGGElement>(null);
  const decorFront = useRef<SVGGElement>(null);

  const engineRef = useRef<BotEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new BotEngine(RAYON, spec.state, SHAPE, resolveExpression(spec.expression));
  }
  const clockRef = useRef(0);
  const levelSmooth = useRef(0);
  const live = useRef({ ...props, spec, effectiveMood });
  live.current = { ...props, spec, effectiveMood };

  // troca de humor → engine morpha (estado/expressão) sem salto
  useEffect(() => {
    const engine = engineRef.current!;
    engine.setState(spec.state, clockRef.current);
    engine.setExpression(resolveExpression(spec.expression), clockRef.current);
  }, [spec.state, spec.expression]);

  useEffect(() => {
    const engine = engineRef.current!;
    const ink = "#26262c";
    let aiming = false;
    let rect: DOMRect | null = null;
    let rectAt = 0;
    let acc = 0;
    let lastDecor = "";
    // instâncias pequenas (barra do notch, grade das configs) não precisam de 60 fps
    const divisor = size <= 48 ? 2 : 1;
    let frameNo = 0;

    const set = (el: Element | null, name: string, value: string) => {
      if (el) el.setAttribute(name, value);
    };

    const paint = (f: BotFrame, level: number) => {
      const cur = live.current;
      set(maskBody.current, "d", f.bodyPath);
      set(paperPath.current, "d", f.bodyPath);
      set(rimPath.current, "d", f.bodyPath);
      set(bodyGroup.current, "opacity", String(f.bodyAlpha));
      for (let i = 0; i < 2; i++) {
        const eye = f.eyes[i];
        set(maskEyes[i].current, "d", eye ? eye.d : "");
        set(maskEyes[i].current, "transform", eye ? eye.matrix : "");
        set(maskEyes[i].current, "opacity", eye ? String(eye.alpha) : "0");
      }

      // boca e bochechas ancoradas nos olhos
      const e0 = f.eyes[0] && matrixTranslation(f.eyes[0].matrix);
      const e1 = f.eyes[1] && matrixTranslation(f.eyes[1].matrix);
      const place = e0 && e1 ? mouthPlacement(e0, e1) : null;
      const faceAlpha = f.eyes.length === 2 ? Math.min(f.eyes[0].alpha, f.eyes[1].alpha) : 0;
      if (place && faceAlpha > 0.05 && e0 && e1) {
        set(faceGroup.current, "opacity", String(faceAlpha));
        const shape = mouthShape(cur.spec.mouth, level);
        const m = mouthPathRef.current;
        if (m) {
          m.setAttribute("d", shape.d);
          m.setAttribute("fill", shape.fill ? cur.color ?? "#fff" : "none");
          m.setAttribute("stroke", shape.fill ? "none" : cur.color ?? "#fff");
          m.setAttribute("stroke-width", String(shape.stroke));
          m.setAttribute(
            "transform",
            `translate(${place.x} ${place.y}) rotate(${place.rotation}) scale(${place.scale})`,
          );
        }
        // bochechas: ponta externa de cada olho, um pouco abaixo
        const left = e0.x <= e1.x ? e0 : e1;
        const right = e0.x <= e1.x ? e1 : e0;
        const len = place.scale / 0.95;
        const dirX = (right.x - left.x) / len;
        const dirY = (right.y - left.y) / len;
        const cheek = (el: SVGEllipseElement | null, ex: number, ey: number, side: -1 | 1) => {
          if (!el) return;
          el.setAttribute("cx", String(ex + dirX * len * 0.34 * side - dirY * len * 0.5));
          el.setAttribute("cy", String(ey + dirY * len * 0.34 * side + dirX * len * 0.5));
          el.setAttribute("rx", String(len * 0.2));
          el.setAttribute("ry", String(len * 0.12));
          el.setAttribute("transform", `rotate(${place.rotation} ${ex + dirX * len * 0.34 * side - dirY * len * 0.5} ${ey + dirY * len * 0.34 * side + dirX * len * 0.5})`);
          el.setAttribute("opacity", String(cur.spec.blush));
        };
        cheek(cheeks[0].current, left.x, left.y, -1);
        cheek(cheeks[1].current, right.x, right.y, 1);
      } else {
        set(faceGroup.current, "opacity", "0");
      }

      // decoração do engine (só em estados especiais)
      const needsDecor = f.arcs.length > 0 || f.dots.length > 0;
      if (needsDecor || lastDecor) {
        const d = needsDecor ? decorMarkup(f, uid, cur.color ?? "#fff", ink) : { defs: "", back: "", behind: "", front: "", arcsFront: "" };
        const key = d.defs + d.back + d.behind + d.front + d.arcsFront;
        if (key !== lastDecor) {
          if (decorDefs.current) decorDefs.current.innerHTML = d.defs;
          if (decorBack.current) decorBack.current.innerHTML = d.back;
          if (decorBehind.current) decorBehind.current.innerHTML = d.behind;
          if (decorFront.current) decorFront.current.innerHTML = d.arcsFront + d.front;
          lastDecor = key;
        }
      }
    };

    const aim = (now: number) => {
      const cur = live.current;
      const pointer = cur.pointer;
      const active = Boolean(
        pointer && Date.now() - pointer.t < POINTER_IDLE_MS && STATE_BY_ID.get(cur.spec.state)?.baseFace,
      );
      if (!active) {
        if (aiming) {
          engine.setLook(null, clockRef.current);
          aiming = false;
        }
        return;
      }
      if (!rect || now - rectAt > 400) {
        rect = svgRef.current?.getBoundingClientRect() ?? null;
        rectAt = now;
      }
      if (!rect || rect.width === 0 || rect.height === 0 || !pointer) return;
      const half = Math.max(240, window.innerWidth / 2);
      const nx = clamp((pointer.x - (rect.left + rect.width / 2)) / half, -1, 1);
      const ny = clamp((pointer.y - (rect.top + rect.height / 2)) / half, -1, 1);
      const look: Look = { yaw: nx * 24, pitch: 6 - ny * 18, mix: 1, spin: 0, wander: 0 };
      engine.setLook(look, clockRef.current);
      aiming = true;
    };

    paint(engine.sample(clockRef.current), 0);

    const unsubscribe = subscribeTicker((dt, now) => {
      const cur = live.current;
      if (cur.paused) return;
      clockRef.current += dt;
      acc += dt;
      if (++frameNo % divisor !== 0) return;
      const step = acc;
      acc = 0;

      aim(now);

      const explicit = Math.max(cur.level ?? 0, cur.levelRef?.current ?? 0);
      const synthetic =
        cur.isSpeaking && explicit <= 0 ? 0.45 + 0.4 * Math.sin(clockRef.current * 18) : 0;
      levelSmooth.current = smoothLevel(levelSmooth.current, Math.max(explicit, synthetic), step);
      paint(engine.sample(clockRef.current), levelSmooth.current);
    });
    return unsubscribe;
    // o loop lê o estado mais recente via `live`; só reinicia se o tamanho mudar de faixa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, size <= 48]);

  const bounce = bounceAnimation(spec.bounce, poked, speakingNow);
  const maskId = `m${uid}`;
  const gradId = `g${uid}`;

  return (
    <motion.div
      className={`relative select-none cursor-pointer flex items-center justify-center ${className}`}
      style={{ width: size, height: size, rotate: spec.tilt ?? 0 }}
      onClick={handleClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      animate={squish ? { scaleX: 1.22, scaleY: 0.78 } : { scaleX: 1, scaleY: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 16 }}
      title="Pherie — Seu companheiro Pherielium"
    >
      <motion.div animate={bounce.animate} transition={bounce.transition} style={{ width: size, height: size }}>
        <svg
          ref={svgRef}
          width={size}
          height={size}
          viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`}
          role="img"
          aria-label="Pherie"
          overflow="visible"
        >
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={-VB} y={-VB} width={VB * 2} height={VB * 2}>
              <path ref={maskBody} fill="#fff" />
              <path ref={maskEyes[0]} fill="#000" />
              <path ref={maskEyes[1]} fill="#000" />
            </mask>
            <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="-110" x2="0" y2="110">
              <stop offset="0" stopColor="#34343a" />
              <stop offset="1" stopColor="#16161a" />
            </linearGradient>
            <defs ref={decorDefs} />
          </defs>

          <g ref={decorBack} fill="none" />
          <g ref={decorBehind} />

          {/* orelhas (atrás do corpo) */}
          <g fill="#1e1e22" stroke="#3e3e46" strokeWidth="3" strokeLinejoin="round">
            <path d="M -88 -66 C -100 -104 -78 -128 -58 -104 Z" />
            <path d="M 88 -66 C 100 -104 78 -128 58 -104 Z" />
          </g>

          <g ref={bodyGroup}>
            {/* o "papel" aparece pelos furos dos olhos (cor do mascote) */}
            <path ref={paperPath} fill={color} />
            <g mask={`url(#${maskId})`}>
              <rect x={-VB} y={-VB} width={VB * 2} height={VB * 2} fill={`url(#${gradId})`} />
            </g>
            <path ref={rimPath} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3" />
            <g ref={faceGroup}>
              <ellipse ref={cheeks[0]} fill="rgb(255,140,160)" />
              <ellipse ref={cheeks[1]} fill="rgb(255,140,160)" />
              <path ref={mouthPathRef} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>

          <g ref={decorFront} fill="none" />

          {/* fone — independente do humor (chamada/música) */}
          <g
            style={{
              opacity: showHeadphones ? 1 : 0,
              transform: showHeadphones ? "scale(1)" : "scale(0.85)",
              transformBox: "fill-box",
              transformOrigin: "center",
              transition: "opacity 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <path d="M -112 6 C -118 -150 118 -150 112 6" fill="none" stroke="#d9d9de" strokeWidth="9" strokeLinecap="round" />
            <rect x="-128" y="-24" width="22" height="62" rx="11" fill="#eeeeee" stroke="#1a1a1e" strokeWidth="3" />
            <rect x="106" y="-24" width="22" height="62" rx="11" fill="#eeeeee" stroke="#1a1a1e" strokeWidth="3" />
            {showMic && (
              <>
                <path d="M -112 34 C -104 82 -64 96 -36 80" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
                <circle cx="-34" cy="80" r="8" fill={color} />
              </>
            )}
          </g>

          {/* extras de emoção */}
          {spec.extras?.includes("sweat") && (
            <path d="M 92 -76 C 102 -56 106 -44 92 -34 C 78 -44 82 -56 92 -76 Z" fill="#7DD3FC" opacity="0.9" />
          )}
          {spec.extras?.includes("tear") && (
            <path d="M -62 26 C -54 42 -52 52 -62 60 C -72 52 -70 42 -62 26 Z" fill="#7DD3FC" opacity="0.9" />
          )}
          {spec.extras?.includes("anger") && (
            <g stroke="#F87171" strokeWidth="9" strokeLinecap="round">
              <path d="M 82 -104 L 102 -84 M 102 -104 L 82 -84" />
            </g>
          )}
          {spec.extras?.includes("thought") && (
            <g fill="rgba(255,255,255,0.7)">
              <circle cx="96" cy="-70" r="7" />
              <circle cx="112" cy="-96" r="10" />
              <circle cx="104" cy="-130" r="14" />
            </g>
          )}
          {spec.extras?.includes("dizzy") && (
            <g fill={color}>
              <animateTransform attributeName="transform" type="rotate" from="0 0 -118" to="360 0 -118" dur="2.2s" repeatCount="indefinite" />
              <circle cx="0" cy="-146" r="8" />
              <circle cx="36" cy="-110" r="6" opacity="0.7" />
              <circle cx="-36" cy="-110" r="6" opacity="0.7" />
            </g>
          )}
          {spec.extras?.includes("question") && (
            <text x="84" y="-78" fontSize="58" fontWeight="bold" fill="rgba(255,255,255,0.78)">
              ?
            </text>
          )}
        </svg>
      </motion.div>

      {effectiveMood === "sleeping" && (
        <motion.div
          className="absolute -top-1 -right-1 pointer-events-none text-[9px] font-bold text-white/50"
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: [0, 1, 0], y: [-1, -8, -12], x: [0, 3, 5] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeOut" }}
        >
          z
        </motion.div>
      )}
    </motion.div>
  );
};
