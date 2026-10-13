import React from "react";
import { useGamepad } from "../../context/GamepadContext";
import { useLiveGamepad } from "../../hooks/useLiveGamepad";
import { KIND_LABEL, describePressed, stickPoint } from "../../lib/gamepadLayout";
import { acquireLauncherInputLock } from "../../utils/launcherInputLock";
import ControllerVisualizer from "../controller/ControllerVisualizer";
import { SettingsCard as Card } from "./SettingsCard";

/** Quanto segurar Share + Options para sair do modo teste só com o controle. */
const EXIT_COMBO_MS = 1000;
const BACK_BUTTON = 8; // Share / View
const START_BUTTON = 9; // Options / Menu

const percent = (v: number) => `${Math.round(v * 100)}%`;
const axisText = (v: number | undefined) => (v ?? 0).toFixed(2);

interface LiveControllerCardProps {
  deadzoneLeft: number;
  deadzoneRight: number;
  /** Controle fixado pela pessoa na lista (ou `null` para seguir o último que mexeu). */
  pinnedIndex: number | null;
  onPin: (index: number | null) => void;
}

/**
 * O card "Controle ao vivo".
 *
 * É o ÚNICO pedaço da aba que se atualiza a cada quadro (o hook ao vivo muda o
 * estado sempre que um stick se mexe). Fica isolado de propósito: antes, esse
 * estado vivia na seção inteira e cada movimento de stick re-renderizava o
 * editor de perfil, os gráficos e as ferramentas de teste, ~60 vezes por segundo.
 */
export const LiveControllerCard: React.FC<LiveControllerCardProps> = React.memo(
  ({ deadzoneLeft, deadzoneRight, pinnedIndex, onPin }) => {
    const { snapshot } = useLiveGamepad(true, pinnedIndex);
    const gamepad = useGamepad();

    // Modo teste: pausa a navegação do launcher. Sem isso, apertar ✕ confirma o que
    // estiver em foco, ○ volta (e sai das Configurações) e o direcional move o foco
    // — cada botão testado mexeria na tela. Começa DESLIGADO de propósito: quem usa
    // só o controle não pode entrar aqui e ficar preso.
    const [testMode, setTestMode] = React.useState(false);

    React.useEffect(() => {
      if (!testMode) return undefined;
      // Concessão, não booleano: desligar o modo teste devolve só a sua parte e
      // não destrava o que o overlay in-game ainda segura.
      return acquireLauncherInputLock();
    }, [testMode]);

    // Saída pelo teclado. Em captura, para o Esc não fechar as Configurações junto.
    React.useEffect(() => {
      if (!testMode) return undefined;
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        setTestMode(false);
      };
      window.addEventListener("keydown", onKey, true);
      return () => window.removeEventListener("keydown", onKey, true);
    }, [testMode]);

    // Saída só com o controle: segurar Share + Options por 1 s. O snapshot só muda
    // quando algo muda, então o "segurar" precisa de um timer próprio.
    const comboHeld = Boolean(
      snapshot.buttons[BACK_BUTTON]?.pressed && snapshot.buttons[START_BUTTON]?.pressed,
    );
    React.useEffect(() => {
      if (!testMode || !comboHeld) return undefined;
      const timer = window.setTimeout(() => setTestMode(false), EXIT_COMBO_MS);
      return () => window.clearTimeout(timer);
    }, [testMode, comboHeld]);

    const active = snapshot.devices.find((d) => d.index === snapshot.activeIndex) ?? null;
    const family = active?.family ?? gamepad.gamepadFamily;
    const left = stickPoint(snapshot.axes[0] ?? 0, snapshot.axes[1] ?? 0);
    const right = stickPoint(snapshot.axes[2] ?? 0, snapshot.axes[3] ?? 0);
    const pressedText = describePressed(snapshot.pressed);

    return (
      <Card
        title="Controle ao vivo"
        hint="Mexa no controle: o botão apertado acende e o stick mostra a zona morta do perfil."
        action={
          <button
            type="button"
            onClick={() => setTestMode((on) => !on)}
            aria-pressed={testMode}
            className={`shrink-0 cursor-pointer rounded-[var(--radius-control)] border px-3 py-1.5 text-[length:var(--fs-label)] font-medium transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] ${
              testMode
                ? "border-[color:var(--edge-selected)] bg-[color:var(--selection-bg)] text-white"
                : "border-[color:var(--edge-subtle)] text-[var(--ink-muted)] hover:border-[color:var(--edge-strong)] hover:text-white"
            }`}
          >
            {testMode ? "Sair do modo teste" : "Modo teste"}
          </button>
        }
      >
        {testMode ? (
          <p
            role="status"
            data-test-mode="on"
            className="mb-[var(--space-4)] rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)] px-3 py-2 text-[length:var(--fs-label)] text-[var(--ink-muted)]"
          >
            A navegação do launcher está pausada: pode apertar tudo. Para sair, aperte Esc ou segure
            Share + Options por 1 segundo.
          </p>
        ) : (
          <p className="mb-[var(--space-4)] text-[length:var(--fs-label)] text-[var(--ink-faint)]">
            Apertar botões aqui também move o launcher. Ligue o Modo teste para testar sem ele reagir.
          </p>
        )}
        <div className="flex flex-wrap items-start gap-[var(--space-6)]">
          <ControllerVisualizer
            connected={snapshot.devices.length > 0}
            family={family}
            buttons={snapshot.buttons}
            axes={snapshot.axes}
            deadzoneLeft={deadzoneLeft}
            deadzoneRight={deadzoneRight}
            className="w-full max-w-[420px] shrink-0"
          />

          <div className="min-w-[220px] flex-1 space-y-[var(--space-4)]">
            <div>
              <p className="text-[length:var(--fs-label)] uppercase tracking-[var(--tracking-label)] text-[var(--ink-faint)]">
                Pressionando
              </p>
              <p
                className="mt-1 min-h-[1.5em] text-[length:var(--fs-title)] font-semibold text-white"
                data-readout="pressed"
                aria-live="polite"
              >
                {pressedText || (
                  <span className="font-normal text-[var(--ink-faint)]">
                    {snapshot.lastPressed ? `último: ${snapshot.lastPressed.label}` : "—"}
                  </span>
                )}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-[var(--space-4)] gap-y-1 text-[length:var(--fs-label)] tabular-nums text-[var(--ink-muted)]">
              <dt>Stick esquerdo</dt>
              <dd data-readout="left">
                {axisText(left.x)}, {axisText(left.y)}
              </dd>
              <dt>Stick direito</dt>
              <dd data-readout="right">
                {axisText(right.x)}, {axisText(right.y)}
              </dd>
              <dt>Gatilho esquerdo</dt>
              <dd>{percent(snapshot.buttons[6]?.value ?? 0)}</dd>
              <dt>Gatilho direito</dt>
              <dd>{percent(snapshot.buttons[7]?.value ?? 0)}</dd>
            </dl>

            {snapshot.devices.length > 0 && (
              <ul className="space-y-1" aria-label="Controles conectados">
                {snapshot.devices.map((d) => {
                  const isActive = d.index === snapshot.activeIndex;
                  // A bateria vem do Rust para UM controle; só atribui quando é inequívoco.
                  const showBattery = snapshot.devices.length === 1 && gamepad.batteryLevel !== null;
                  return (
                    <li key={d.index}>
                      <button
                        type="button"
                        onClick={() => onPin(pinnedIndex === d.index ? null : d.index)}
                        aria-pressed={isActive}
                        className={`flex w-full cursor-pointer items-center justify-between gap-[var(--gap-inline)] rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] ${
                          isActive
                            ? "border-[color:var(--edge-selected)] bg-[color:var(--selection-bg)]"
                            : "border-[color:var(--edge-subtle)] hover:border-[color:var(--edge-strong)]"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[length:var(--fs-caption)] font-medium text-white">
                            {d.info.name}
                          </span>
                          <span className="block text-[length:var(--fs-label)] text-[var(--ink-muted)]">
                            {KIND_LABEL[d.info.kind]}
                            {d.info.vendor && d.info.product ? ` · ${d.info.vendor}:${d.info.product}` : ""}
                            {!d.info.standardMapping ? " · mapeamento não padrão" : ""}
                          </span>
                        </span>
                        {showBattery && (
                          <span className="shrink-0 text-[length:var(--fs-label)] tabular-nums text-[var(--ink-muted)]">
                            {gamepad.batteryApproximate ? "≈ " : ""}
                            {gamepad.batteryLevel}%{gamepad.batteryCharging ? " ⚡" : ""}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Card>

    );
  },
);

LiveControllerCard.displayName = "LiveControllerCard";
export default LiveControllerCard;
