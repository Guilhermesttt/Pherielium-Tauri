import React from "react";
import { useAxisRecorder, type StickSide } from "../../hooks/useAxisRecorder";
import {
  RUMBLE_MODES,
  RUMBLE_MODE_IDS,
  actuatorOf,
  manualStep,
  playRumble,
  type RumbleModeId,
} from "../../lib/gamepadRumble";
import {
  MIN_RELIABLE_COVERAGE,
  circularityReport,
  driftReport,
  type AxisSample,
} from "../../lib/stickAnalysis";
import { Row, Segmented, Slider } from "./ControllerProfileFields";

interface ControllerToolsProps {
  /** Lê o controle ativo na hora (não depende de re-render). */
  getPad: () => Gamepad | null;
  /** Há um controle conectado? */
  connected: boolean;
  /** Intensidade de vibração do perfil (0..1): multiplica o teste. */
  rumbleIntensity: number;
  /** Aplica a zona morta sugerida ao perfil em edição. */
  onApplyDeadzone: (stick: StickSide, value: number) => void;
}

const STICK_OPTIONS: ReadonlyArray<{ value: StickSide; label: string }> = [
  { value: "left", label: "Esquerdo" },
  { value: "right", label: "Direito" },
];

const percent = (v: number) => `${Math.round(v * 100)}%`;
const DRIFT_SECONDS = 3;
/** Teto de pontos desenhados: acima disso desenhar mais não muda nada visível. */
const MAX_DRAWN_POINTS = 1200;

const downsample = (samples: ReadonlyArray<AxisSample>): AxisSample[] => {
  if (samples.length <= MAX_DRAWN_POINTS) return samples.slice();
  const step = samples.length / MAX_DRAWN_POINTS;
  return Array.from({ length: MAX_DRAWN_POINTS }, (_, i) => samples[Math.floor(i * step)]);
};

const Panel: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <div className="rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)] p-[var(--space-4)]">
    <h4 className="text-[length:var(--fs-title)] font-semibold text-white">{title}</h4>
    <p className="mb-[var(--space-3)] mt-0.5 text-[length:var(--fs-label)] text-white/50">{hint}</p>
    {children}
  </div>
);

const ActionButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  pressed?: boolean;
}> = ({ onClick, children, disabled, pressed }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={pressed}
    className={`cursor-pointer rounded-[var(--radius-control)] border px-3 py-1.5 text-[length:var(--fs-label)] font-medium transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] disabled:cursor-not-allowed disabled:opacity-40 ${
      pressed
        ? "border-[color:var(--edge-selected)] bg-[color:var(--selection-bg)] text-white"
        : "border-[color:var(--edge-subtle)] text-white/70 hover:border-[color:var(--edge-strong)] hover:text-white"
    }`}
  >
    {children}
  </button>
);

/** Plano -1..1 com o anel unitário, para as duas medições de stick. */
const StickPlot = React.memo<{
  samples: ReadonlyArray<AxisSample>;
  /** Meia-largura visível: 1,2 para circularidade, menos para ver o ruído do repouso. */
  extent: number;
  label: string;
  kind: "drift" | "circularity";
}>(({ samples, extent, label, kind }) => {
  const size = 150;
  const scale = size / 2 / extent;
  const c = size / 2;
  const drawn = downsample(samples);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      data-plot={kind}
      data-points={samples.length}
      className="shrink-0 rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)]"
      style={{ background: "color-mix(in srgb, var(--surface-base) 60%, transparent)" }}
    >
      <line x1={0} y1={c} x2={size} y2={c} stroke="var(--edge-subtle)" />
      <line x1={c} y1={0} x2={c} y2={size} stroke="var(--edge-subtle)" />
      {kind === "circularity" && (
        <circle cx={c} cy={c} r={scale} fill="none" stroke="var(--edge-strong)" strokeDasharray="3 4" />
      )}
      {drawn.map((p, i) => (
        <circle
          key={i}
          cx={c + p.x * scale}
          cy={c + p.y * scale}
          r={1.4}
          fill="rgb(var(--launcher-accent))"
          fillOpacity={0.7}
        />
      ))}
    </svg>
  );
});
StickPlot.displayName = "StickPlot";

export const ControllerTools: React.FC<ControllerToolsProps> = React.memo(({
  getPad,
  connected,
  rumbleIntensity,
  onApplyDeadzone,
}) => {
  // ── Vibração ──────────────────────────────────────────────────────────────
  const [weak, setWeak] = React.useState(0.5);
  const [strong, setStrong] = React.useState(0.5);
  const [playing, setPlaying] = React.useState<string | null>(null);
  const [rumbleNote, setRumbleNote] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const actuator = connected ? actuatorOf(getPad()) : null;
  const silent = rumbleIntensity <= 0;

  const stopRumble = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Sai da aba com o controle vibrando: para.
  React.useEffect(() => stopRumble, [stopRumble]);

  const run = React.useCallback(
    async (key: string, steps: ReadonlyArray<ReturnType<typeof manualStep>>, loop = false) => {
      const device = actuatorOf(getPad());
      if (!device) {
        setRumbleNote("Este controle não informa vibração ao aplicativo.");
        return;
      }
      stopRumble();
      const controller = new AbortController();
      abortRef.current = controller;
      setPlaying(key);
      setRumbleNote(null);
      try {
        do {
          const outcome = await playRumble(device, steps, rumbleIntensity, controller.signal);
          if (outcome === "failed") {
            setRumbleNote("O controle recusou a vibração (desconectado?).");
            break;
          }
        } while (loop && !controller.signal.aborted);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setPlaying((current) => (current === key ? null : current));
      }
    },
    [getPad, rumbleIntensity, stopRumble],
  );

  // ── Drift e circularidade ─────────────────────────────────────────────────
  const drift = useAxisRecorder(getPad);
  const circle = useAxisRecorder(getPad);
  const [driftStick, setDriftStick] = React.useState<StickSide>("left");
  const [circleStick, setCircleStick] = React.useState<StickSide>("left");

  const driftResult = drift.state.status === "done" ? driftReport(drift.state.samples) : null;
  const circleResult =
    circle.state.status === "idle" ? null : circularityReport(circle.state.samples);

  return (
    <div className="space-y-[var(--space-4)]" data-section="controller-tools">
      {/* Vibração */}
      <Panel
        title="Vibração"
        hint="Os controles têm dois motores: o grave (forte) e o agudo (fraco). A intensidade do perfil multiplica o teste."
      >
        {silent && (
          <p className="mb-[var(--space-3)] text-[length:var(--fs-label)] text-white/60" role="note">
            A vibração do perfil está em 0%: o teste não vai sentir nada. Aumente em “Intensidade da vibração”.
          </p>
        )}
        <div className="flex flex-wrap gap-[var(--gap-inline)]" role="group" aria-label="Modos de vibração">
          {RUMBLE_MODE_IDS.map((id: RumbleModeId) => (
            <ActionButton
              key={id}
              disabled={!connected || !actuator}
              pressed={playing === id}
              onClick={() => void run(id, RUMBLE_MODES[id].steps)}
            >
              {RUMBLE_MODES[id].label}
            </ActionButton>
          ))}
        </div>

        <div className="mt-[var(--space-3)]">
          <Row label="Motor grave (forte)">
            <Slider label="Motor grave" value={strong} min={0} max={1} step={0.05} onChange={setStrong} format={percent} />
          </Row>
          <Row label="Motor agudo (fraco)">
            <Slider label="Motor agudo" value={weak} min={0} max={1} step={0.05} onChange={setWeak} format={percent} />
          </Row>
        </div>

        <div className="mt-[var(--space-3)] flex flex-wrap items-center gap-[var(--gap-inline)]">
          <ActionButton
            disabled={!connected || !actuator}
            pressed={playing === "manual"}
            onClick={() => void run("manual", [manualStep(weak, strong, 1000)])}
          >
            Vibrar 1 segundo
          </ActionButton>
          <ActionButton
            disabled={!connected || !actuator}
            pressed={playing === "loop"}
            onClick={() =>
              playing === "loop" ? stopRumble() : void run("loop", [manualStep(weak, strong, 800)], true)
            }
          >
            {playing === "loop" ? "Parar" : "Vibrar sem parar"}
          </ActionButton>
          {playing && <span className="text-[length:var(--fs-label)] text-white/60" role="status">Vibrando…</span>}
        </div>

        {connected && !actuator && (
          <p className="mt-[var(--space-3)] text-[length:var(--fs-label)] text-white/50" data-rumble="unsupported">
            Este controle não informa vibração ao aplicativo.
          </p>
        )}
        {rumbleNote && (
          <p className="mt-[var(--space-3)] text-[length:var(--fs-label)] text-white/60" role="alert">
            {rumbleNote}
          </p>
        )}
      </Panel>

      {/* Drift */}
      <Panel
        title="Drift em repouso"
        hint={`Solte o stick e não toque nele por ${DRIFT_SECONDS} s. Mede o desvio do centro e sugere a zona morta que o esconde.`}
      >
        <div className="flex flex-wrap items-start gap-[var(--space-6)]">
          <StickPlot
            samples={drift.state.samples}
            extent={0.25}
            label="Posição do stick em repouso"
            kind="drift"
          />
          <div className="min-w-[220px] flex-1 space-y-[var(--space-3)]">
            <div className="flex flex-wrap items-center gap-[var(--gap-inline)]">
              <Segmented
                label="Stick do teste de drift"
                value={driftStick}
                options={STICK_OPTIONS}
                onChange={setDriftStick}
              />
              <ActionButton
                disabled={!connected || drift.state.status === "running"}
                onClick={() => drift.start(driftStick, DRIFT_SECONDS * 1000)}
              >
                {drift.state.status === "running" ? "Medindo…" : "Medir drift"}
              </ActionButton>
            </div>

            {drift.state.status === "running" && (
              <p className="text-[length:var(--fs-label)] text-white/60" role="status">
                Não toque no stick… {Math.max(0, DRIFT_SECONDS - drift.state.elapsedMs / 1000).toFixed(1)} s
              </p>
            )}

            {driftResult && (
              <dl
                className="grid grid-cols-2 gap-x-[var(--space-4)] gap-y-1 text-[length:var(--fs-label)] tabular-nums text-white/70"
                data-drift-verdict={driftResult.verdict}
                data-drift-suggested={driftResult.suggestedDeadzone.toFixed(2)}
              >
                <dt>Desvio do centro</dt>
                <dd>{driftResult.offset.toFixed(3)}</dd>
                <dt>Maior raio em repouso</dt>
                <dd>{driftResult.maxRadius.toFixed(3)}</dd>
                <dt>Diagnóstico</dt>
                <dd>
                  {driftResult.verdict === "ok" ? "Sem drift relevante" : driftResult.verdict === "leve" ? "Drift leve" : "Drift alto"}
                </dd>
                <dt>Zona morta sugerida</dt>
                <dd>{percent(driftResult.suggestedDeadzone)}</dd>
              </dl>
            )}
            {drift.state.status === "done" && !driftResult && (
              <p className="text-[length:var(--fs-label)] text-white/60" role="alert">
                Poucas leituras do controle. Confira se ele está conectado e tente de novo.
              </p>
            )}

            {driftResult && (
              <ActionButton onClick={() => onApplyDeadzone(drift.state.stick, driftResult.suggestedDeadzone)}>
                Aplicar {percent(driftResult.suggestedDeadzone)} ao stick{" "}
                {drift.state.stick === "left" ? "esquerdo" : "direito"}
              </ActionButton>
            )}
          </div>
        </div>
      </Panel>

      {/* Circularidade */}
      <Panel
        title="Circularidade"
        hint="Gire o stick até a borda, dando voltas completas. Mede o quanto o curso se afasta de um círculo."
      >
        <div className="flex flex-wrap items-start gap-[var(--space-6)]">
          <StickPlot
            samples={circle.state.samples}
            extent={1.25}
            label="Trajeto do stick"
            kind="circularity"
          />
          <div className="min-w-[220px] flex-1 space-y-[var(--space-3)]">
            <div className="flex flex-wrap items-center gap-[var(--gap-inline)]">
              <Segmented
                label="Stick do teste de circularidade"
                value={circleStick}
                options={STICK_OPTIONS}
                onChange={setCircleStick}
              />
              {circle.state.status === "running" ? (
                <ActionButton onClick={circle.finish}>Concluir</ActionButton>
              ) : (
                <ActionButton disabled={!connected} onClick={() => circle.start(circleStick)}>
                  {circle.state.status === "done" ? "Refazer" : "Iniciar"}
                </ActionButton>
              )}
            </div>

            {circleResult && (
              <dl
                className="grid grid-cols-2 gap-x-[var(--space-4)] gap-y-1 text-[length:var(--fs-label)] tabular-nums text-white/70"
                data-circularity-coverage={circleResult.coverage.toFixed(0)}
                data-circularity-error={circleResult.errorPercent.toFixed(1)}
                data-circularity-complete={circleResult.complete ? "true" : "false"}
              >
                <dt>Volta percorrida</dt>
                <dd>{circleResult.coverage.toFixed(0)}%</dd>
                <dt>Erro de circularidade</dt>
                <dd>{circleResult.complete ? `${circleResult.errorPercent.toFixed(1)}%` : "—"}</dd>
              </dl>
            )}
            {circleResult && !circleResult.complete && (
              <p className="text-[length:var(--fs-label)] text-white/60" role="status">
                Dê uma volta completa na borda (mínimo de {MIN_RELIABLE_COVERAGE}%) para o erro valer.
              </p>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
});
ControllerTools.displayName = "ControllerTools";

export default ControllerTools;
