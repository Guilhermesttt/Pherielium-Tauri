import React from "react";
import { Gamepad2, RotateCcw, ExternalLink, AlertTriangle } from "lucide-react";
import ModalShell from "../ui/ModalShell";
import { openExternal } from "../../utils/openExternal";
import { useControllerProfile } from "../../hooks/useControllerProfile";
import { Row, Slider, Toggle } from "../controller/ControllerProfileFields";
import {
  CONTROLLER_PRESETS,
  EMULATION_BLOCK_HINT,
  HIDHIDE_RELEASE_URL,
  PRESET_LABELS,
  VIGEM_RELEASE_URL,
  emulationBlock,
  type ControllerSettings,
  type PresetName,
} from "../../services/controllerProfile";
import type { SoundEffectType } from "../../hooks/useSoundEffects";

interface GameControllerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string | null | undefined;
  gameId: string;
  gameTitle: string;
  /** Abre a aba completa de Configurações já neste jogo. */
  onOpenAdvanced?: () => void;
  playSound?: (type: SoundEffectType) => void;
}

/** Qual preset bate com o que está na tela (ou nenhum, se foi ajustado à mão). */
const matchPreset = (s: ControllerSettings): PresetName | null => {
  const entries = Object.entries(CONTROLLER_PRESETS) as Array<[PresetName, ControllerSettings]>;
  const found = entries.find(([, preset]) =>
    (Object.keys(preset) as Array<keyof ControllerSettings>).every(
      (key) => preset[key] === s[key],
    ),
  );
  return found ? found[0] : null;
};

export const GameControllerPanel: React.FC<GameControllerPanelProps> = ({
  isOpen,
  onClose,
  uid,
  gameId,
  gameTitle,
  onOpenAdvanced,
  playSound,
}) => {
  const { settings, origin, loading, saving, error, drivers, update, replace, resetToGlobal } =
    useControllerProfile(uid, gameId);

  const activePreset = React.useMemo(() => matchPreset(settings), [settings]);
  const usesGameProfile = origin === "game";
  // Mesma regra da aba de Configurações: sem os dois drivers a emulação duplicaria
  // a entrada, e sem o motor nativo ela nem teria efeito dentro do jogo.
  const block = emulationBlock(drivers);

  // O aviso com link só aparece quando o que falta é um driver (algo que a
  // pessoa resolve); "motor ainda não existe" não tem o que baixar.
  const missingDriver =
    block === "vigem"
      ? { name: "ViGEmBus", url: VIGEM_RELEASE_URL }
      : block === "hidhide"
        ? { name: "HidHide", url: HIDHIDE_RELEASE_URL }
        : null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-[560px]"
      zIndexClassName="z-[180]"
      gamepadPriority={200}
      ariaLabel={`Controle em ${gameTitle}`}
      className="theme-panel flex max-h-[85vh] w-full flex-col overflow-hidden p-0 text-white"
    >
      <header className="flex items-start justify-between gap-[var(--gap-inline)] px-[var(--space-6)] pt-[var(--space-6)] pb-[var(--space-4)]">
        <div className="flex min-w-0 items-center gap-[var(--gap-inline)]">
          <Gamepad2 className="h-5 w-5 shrink-0 text-white/70" />
          <div className="min-w-0">
            <h2 className="truncate text-[length:var(--fs-title)] font-semibold">Controle</h2>
            <p className="truncate text-[length:var(--fs-label)] text-white/50">{gameTitle}</p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-[var(--radius-badge)] border border-[color:var(--edge-subtle)] px-2 py-1 text-[length:var(--fs-label)] text-white/60"
          title={
            usesGameProfile
              ? "Este jogo tem ajustes próprios."
              : "Este jogo segue o perfil usado em todo o launcher."
          }
        >
          {usesGameProfile ? "Perfil do jogo" : "Perfil global"}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto thin-scrollbar px-[var(--space-6)] pb-[var(--space-4)]">
        {loading ? (
          <p className="py-[var(--space-8)] text-center text-[length:var(--fs-caption)] text-white/50">
            Carregando perfil…
          </p>
        ) : (
          <>
            {/* Presets */}
            <div className="flex flex-wrap gap-[var(--gap-inline)] pb-[var(--space-4)]">
              {(Object.keys(CONTROLLER_PRESETS) as PresetName[]).map((name) => {
                const active = activePreset === name;
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      playSound?.("select");
                      replace({ ...CONTROLLER_PRESETS[name] });
                    }}
                    className={`cursor-pointer rounded-[var(--radius-control)] border px-3 py-1.5 text-[length:var(--fs-label)] font-medium transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] ${
                      active
                        ? "border-[color:var(--edge-selected)] bg-[color:var(--selection-bg)] text-white"
                        : "border-[color:var(--edge-subtle)] text-white/70 hover:border-[color:var(--edge-strong)] hover:text-white"
                    }`}
                  >
                    {PRESET_LABELS[name]}
                  </button>
                );
              })}
            </div>

            <Row label="Zona morta" hint="Quanto o stick anda antes de valer.">
              <Slider
                label="Zona morta"
                value={settings.deadzoneLeft}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => update({ deadzoneLeft: v, deadzoneRight: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </Row>

            <Row label="Sensibilidade">
              <Slider
                label="Sensibilidade"
                value={settings.sensitivity}
                min={0.25}
                max={3}
                step={0.05}
                onChange={(v) => update({ sensitivity: v })}
                format={(v) => `${v.toFixed(2)}×`}
              />
            </Row>

            <Row label="Inverter eixo Y">
              <Toggle
                label="Inverter eixo Y"
                checked={settings.invertY}
                onChange={(v) => update({ invertY: v })}
              />
            </Row>

            <Row label="Vibração">
              <Slider
                label="Vibração"
                value={settings.rumble}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => update({ rumble: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </Row>

            <Row
              label="Emular Xbox 360"
              hint={
                block === null
                  ? "O jogo passa a ver um controle Xbox padrão."
                  : EMULATION_BLOCK_HINT[block]
              }
            >
              <Toggle
                label="Emular Xbox 360"
                checked={settings.emulateXinput && block === null}
                disabled={block !== null}
                onChange={(v) => update({ emulateXinput: v })}
              />
            </Row>

            {missingDriver && (
              <div className="mt-[var(--space-4)] flex items-start gap-[var(--gap-inline)] rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)] bg-white/[0.03] p-[var(--space-3)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
                <div className="min-w-0 text-[length:var(--fs-label)] text-white/60">
                  <p>
                    Sem o <strong className="text-white/80">{missingDriver.name}</strong> o jogo lê o
                    controle físico e o virtual ao mesmo tempo, e a entrada chega duplicada.
                  </p>
                  <button
                    type="button"
                    onClick={() => void openExternal(missingDriver.url)}
                    className="mt-1 inline-flex cursor-pointer items-center gap-1 text-white/80 underline underline-offset-2 hover:text-white"
                  >
                    Baixar {missingDriver.name}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-[var(--space-3)] text-[length:var(--fs-label)] text-red-400">{error}</p>
            )}
          </>
        )}
      </div>

      <footer className="flex items-center justify-between gap-[var(--gap-inline)] border-t border-[color:var(--edge-subtle)] px-[var(--space-6)] py-[var(--space-4)]">
        <span className="text-[length:var(--fs-label)] text-white/40">
          {saving ? "Salvando…" : "Salvo automaticamente"}
        </span>
        <div className="flex items-center gap-[var(--gap-inline)]">
          {usesGameProfile && (
            <button
              type="button"
              onClick={() => {
                playSound?.("back");
                void resetToGlobal();
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)] px-3 py-1.5 text-[length:var(--fs-label)] text-white/70 transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] hover:border-[color:var(--edge-strong)] hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Usar global
            </button>
          )}
          {onOpenAdvanced && (
            <button
              type="button"
              onClick={() => {
                playSound?.("select");
                onOpenAdvanced();
              }}
              className="cursor-pointer rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)] px-3 py-1.5 text-[length:var(--fs-label)] text-white/70 transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] hover:border-[color:var(--edge-strong)] hover:text-white"
            >
              Configurações avançadas
            </button>
          )}
        </div>
      </footer>
    </ModalShell>
  );
};

export default React.memo(GameControllerPanel);
