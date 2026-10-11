import React from "react";
import type { GamepadFamily } from "../../context/GamepadContext";
import {
  buttonLabel,
  stickPoint,
  type ButtonId,
  type ButtonSample,
} from "../../lib/gamepadLayout";

interface ControllerVisualizerProps {
  connected: boolean;
  family: GamepadFamily;
  buttons: ReadonlyArray<ButtonSample>;
  /** [lx, ly, rx, ry] no mapeamento standard. */
  axes: ReadonlyArray<number>;
  /** Raio da zona morta de cada stick (0..0.5), desenhado como um anel. */
  deadzoneLeft?: number;
  deadzoneRight?: number;
  className?: string;
}

/** Índice standard de cada botão desenhado. */
const INDEX: Record<ButtonId, number> = {
  face_bottom: 0, face_right: 1, face_left: 2, face_top: 3,
  lb: 4, rb: 5, lt: 6, rt: 7,
  back: 8, start: 9, l3: 10, r3: 11,
  dpad_up: 12, dpad_down: 13, dpad_left: 14, dpad_right: 15,
  guide: 16, touchpad: 17,
};

// Cores só por token do tema: o visualizador herda qualquer tema sem cor nova.
const C = {
  body: "var(--surface-raised)",
  bodyStroke: "var(--edge-strong)",
  idleFill: "color-mix(in srgb, var(--surface-base) 70%, transparent)",
  idleStroke: "var(--edge-strong)",
  activeFill: "rgb(var(--launcher-accent) / 0.92)",
  activeStroke: "rgb(var(--launcher-accent))",
  activeText: "var(--surface-base)",
  idleText: "color-mix(in srgb, var(--color-text-main) 65%, transparent)",
  guide: "color-mix(in srgb, var(--color-text-main) 35%, transparent)",
} as const;

const FADE = "var(--motion-instant) var(--ease-focus)";

type Point = readonly [number, number];

interface Layout {
  leftStick: Point;
  rightStick: Point;
  dpad: Point;
  face: Point;
  back: Point;
  start: Point;
  guide: Point;
}

/**
 * Posições dos controles por família. O Xbox tem o stick esquerdo no alto e o
 * direcional embaixo; o PlayStation tem o direcional no alto e os dois sticks
 * simétricos embaixo. Tabela, não `if` por família.
 */
const LAYOUTS: Record<"xbox" | "playstation", Layout> = {
  xbox: {
    leftStick: [112, 112],
    rightStick: [252, 158],
    dpad: [150, 163],
    face: [290, 112],
    back: [168, 120],
    start: [218, 120],
    guide: [200, 146],
  },
  playstation: {
    leftStick: [160, 160],
    rightStick: [240, 160],
    dpad: [112, 112],
    face: [288, 112],
    back: [150, 94],
    start: [236, 94],
    guide: [200, 160],
  },
};

const layoutFor = (family: GamepadFamily): Layout =>
  family === "playstation" ? LAYOUTS.playstation : LAYOUTS.xbox;

const STICK_R = 26;
const KNOB_R = 11;
const STICK_TRAVEL = STICK_R - KNOB_R - 1;

export const ControllerVisualizer: React.FC<ControllerVisualizerProps> = React.memo(
  ({ connected, family, buttons, axes, deadzoneLeft = 0, deadzoneRight = 0, className }) => {
    const value = (id: ButtonId) => buttons[INDEX[id]]?.value ?? 0;
    const on = (id: ButtonId) => {
      const b = buttons[INDEX[id]];
      return Boolean(b && (b.pressed || b.value >= 0.5));
    };

    const shape = (id: ButtonId) => ({
      fill: on(id) ? C.activeFill : C.idleFill,
      stroke: on(id) ? C.activeStroke : C.idleStroke,
      style: { transition: `fill ${FADE}, stroke ${FADE}` } as React.CSSProperties,
      "data-button": id,
      "data-active": on(id) ? "true" : "false",
    });

    const text = (id: ButtonId) => (on(id) ? C.activeText : C.idleText);

    const lay = layoutFor(family);
    const left = stickPoint(axes[0] ?? 0, axes[1] ?? 0);
    const right = stickPoint(axes[2] ?? 0, axes[3] ?? 0);

    // Funções de render (não componentes): definir componente dentro do render
    // o recriaria a cada quadro, e este desenho re-renderiza a cada input.
    const renderFace = (id: ButtonId, cx: number, cy: number) => (
      <g key={id}>
        <circle cx={cx} cy={cy} r={10} strokeWidth={1.5} {...shape(id)} />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill={text(id)}
          style={{ transition: `fill ${FADE}`, pointerEvents: "none" }}
        >
          {buttonLabel(INDEX[id], family)}
        </text>
      </g>
    );

    const renderStick = (
      cx: number,
      cy: number,
      point: ReturnType<typeof stickPoint>,
      deadzone: number,
      click: ButtonId,
      id: string,
    ) => (
      <g key={id} data-stick={id}>
        <circle cx={cx} cy={cy} r={STICK_R} fill={C.idleFill} stroke={C.idleStroke} strokeWidth={1.5} />
        {deadzone > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={Math.max(2, deadzone * STICK_R * 2)}
            fill="none"
            stroke={C.idleStroke}
            strokeWidth={1}
            strokeDasharray="2 3"
            data-deadzone={id}
          />
        )}
        <circle
          cx={cx + point.x * STICK_TRAVEL}
          cy={cy + point.y * STICK_TRAVEL}
          r={KNOB_R}
          strokeWidth={1.5}
          {...shape(click)}
          fill={on(click) ? C.activeFill : point.magnitude > 0.05 ? C.activeFill : C.idleFill}
          fillOpacity={on(click) ? 1 : point.magnitude > 0.05 ? 0.55 : 1}
        />
      </g>
    );

    return (
      <svg
        viewBox="0 0 400 260"
        role="img"
        aria-label="Controle ao vivo"
        className={className}
        data-connected={connected ? "true" : "false"}
      >
        {/* Gatilhos: enchem conforme o quanto foram apertados */}
        {(["lt", "rt"] as const).map((id) => {
          const x = id === "lt" ? 72 : 274;
          const v = Math.min(1, Math.max(0, value(id)));
          return (
            <g key={id} data-button={id} data-active={on(id) ? "true" : "false"} data-value={v.toFixed(2)}>
              <rect x={x} y={14} width={54} height={30} rx={8} fill={C.idleFill} stroke={C.idleStroke} strokeWidth={1.5} />
              <rect x={x + 1} y={14 + 30 * (1 - v)} width={52} height={30 * v} rx={7} fill={C.activeFill} />
              <text x={x + 27} y={34} textAnchor="middle" fontSize={11} fontWeight={700} fill={v > 0.55 ? C.activeText : C.idleText} style={{ pointerEvents: "none" }}>
                {buttonLabel(INDEX[id], family)}
              </text>
            </g>
          );
        })}

        {/* Bumpers */}
        <rect x={62} y={50} width={72} height={10} rx={5} strokeWidth={1.5} {...shape("lb")} />
        <rect x={266} y={50} width={72} height={10} rx={5} strokeWidth={1.5} {...shape("rb")} />

        {/* Corpo */}
        <path
          d="M 90 66 C 60 66 30 116 24 186 C 20 221 40 241 62 234 C 85 226 95 201 120 186 L 280 186 C 305 201 315 226 338 234 C 360 241 380 221 376 186 C 370 116 340 66 310 66 Z"
          fill={C.body}
          stroke={C.bodyStroke}
          strokeWidth={2}
        />

        {/* Sticks */}
        {renderStick(lay.leftStick[0], lay.leftStick[1], left, deadzoneLeft, "l3", "left")}
        {renderStick(lay.rightStick[0], lay.rightStick[1], right, deadzoneRight, "r3", "right")}

        {/* D-pad */}
        <g>
          <rect x={lay.dpad[0] - 7} y={lay.dpad[1] - 23} width={14} height={20} rx={3} strokeWidth={1.5} {...shape("dpad_up")} />
          <rect x={lay.dpad[0] - 7} y={lay.dpad[1] + 3} width={14} height={20} rx={3} strokeWidth={1.5} {...shape("dpad_down")} />
          <rect x={lay.dpad[0] - 30} y={lay.dpad[1] - 7} width={20} height={14} rx={3} strokeWidth={1.5} {...shape("dpad_left")} />
          <rect x={lay.dpad[0] + 10} y={lay.dpad[1] - 7} width={20} height={14} rx={3} strokeWidth={1.5} {...shape("dpad_right")} />
        </g>

        {/* Botões de ação (losango) */}
        {renderFace("face_top", lay.face[0], lay.face[1] - 24)}
        {renderFace("face_right", lay.face[0] + 26, lay.face[1])}
        {renderFace("face_bottom", lay.face[0], lay.face[1] + 24)}
        {renderFace("face_left", lay.face[0] - 26, lay.face[1])}

        {/* Centro */}
        {family === "playstation" && (
          <rect x={172} y={84} width={56} height={26} rx={6} strokeWidth={1.5} {...shape("touchpad")} />
        )}
        <rect x={lay.back[0]} y={lay.back[1]} width={14} height={8} rx={4} strokeWidth={1.5} {...shape("back")} />
        <rect x={lay.start[0]} y={lay.start[1]} width={14} height={8} rx={4} strokeWidth={1.5} {...shape("start")} />
        <circle cx={lay.guide[0]} cy={lay.guide[1]} r={7} strokeWidth={1.5} {...shape("guide")} />
        <circle cx={lay.guide[0]} cy={lay.guide[1]} r={2.5} fill={on("guide") ? C.activeText : C.guide} />

        {!connected && (
          <g role="status">
            <rect x={70} y={96} width={260} height={44} rx={10} fill={C.body} stroke={C.idleStroke} strokeWidth={1} />
            <text x={200} y={115} textAnchor="middle" fontSize={12} fontWeight={600} fill={C.idleText}>
              Mexa o controle ou aperte
            </text>
            <text x={200} y={131} textAnchor="middle" fontSize={12} fontWeight={600} fill={C.idleText}>
              um botão para detectar
            </text>
          </g>
        )}
      </svg>
    );
  },
);

ControllerVisualizer.displayName = "ControllerVisualizer";
export default ControllerVisualizer;
