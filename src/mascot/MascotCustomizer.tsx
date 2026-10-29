import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BACKGROUND_OPACITY_RANGE,
  CORNER_RADIUS_RANGE,
  type NotchConfig,
} from "./notchConfig";
import { resolveNotchStyle } from "./notchTheme";
import { saveNotchConfig, useOverlayAppearance } from "./useNotchConfig";

/** Edita a config do notch com gravação em debounce (compartilhado por Ajustes e pela gaveta do overlay). */
export function useNotchConfigEditor() {
  const { config, visualTheme } = useOverlayAppearance();
  const [draft, setDraft] = useState<NotchConfig>(config);
  const draftRef = useRef(draft);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // mudanças vindas de fora (outra janela) entram quando não há edição pendente
  useEffect(() => {
    if (timer.current) return;
    draftRef.current = config;
    setDraft(config);
  }, [config]);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void saveNotchConfig(draftRef.current);
      }
    },
    [],
  );

  const update = useCallback((patch: Partial<NotchConfig>) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void saveNotchConfig(draftRef.current);
    }, 150);
  }, []);

  return { draft, update, visualTheme };
}

const chip = (active: boolean) =>
  `rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors ${
    active
      ? "border-white/45 bg-white/[0.14] text-white"
      : "border-white/[0.08] bg-white/[0.04] text-white/65 hover:bg-white/[0.09]"
  }`;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col gap-2">
    <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{title}</h4>
    {children}
  </section>
);

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  onReset: () => void;
  custom: boolean;
}> = ({ label, value, min, max, step, format, onChange, onReset, custom }) => (
  <label className="flex flex-col gap-1">
    <span className="flex items-center justify-between text-[12px] text-white/75">
      {label}
      <span className="flex items-center gap-2 tabular-nums text-white/50">
        {format(value)}
        {custom && (
          <button type="button" onClick={onReset} className="text-[10px] underline text-white/45 hover:text-white/80">
            tema
          </button>
        )}
      </span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-white"
    />
  </label>
);

/**
 * Estilo do notch (cantos, brilho, opacidade). Sem `Switch`/`usePreferences`: o overlay
 * não tem o PreferencesProvider.
 */
export const MascotCustomizer: React.FC<{ compact?: boolean }> = () => {
  const { draft, update, visualTheme } = useNotchConfigEditor();
  const themed = resolveNotchStyle(visualTheme, draft);

  return (
    <div className="flex flex-col gap-5">
      <Section title="Estilo do notch">
        <div className="flex gap-1.5">
          <button type="button" onClick={() => update({ useThemeStyle: true })} className={chip(draft.useThemeStyle)}>
            Seguir o tema
          </button>
          <button type="button" onClick={() => update({ useThemeStyle: false })} className={chip(!draft.useThemeStyle)}>
            Padrão
          </button>
        </div>
        <div className="mt-1 flex flex-col gap-3">
          <Slider
            label="Cantos"
            value={themed.cornerRadius}
            min={CORNER_RADIUS_RANGE.min}
            max={CORNER_RADIUS_RANGE.max}
            step={1}
            format={(v) => `${Math.round(v)} px`}
            custom={draft.cornerRadius !== null}
            onChange={(v) => update({ cornerRadius: v })}
            onReset={() => update({ cornerRadius: null })}
          />
          <Slider
            label="Brilho da borda"
            value={themed.glow}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            custom={draft.glowIntensity !== null}
            onChange={(v) => update({ glowIntensity: v })}
            onReset={() => update({ glowIntensity: null })}
          />
          <Slider
            label="Opacidade do fundo"
            value={themed.surfaceOpacity}
            min={BACKGROUND_OPACITY_RANGE.min}
            max={BACKGROUND_OPACITY_RANGE.max}
            step={0.02}
            format={(v) => `${Math.round(v * 100)}%`}
            custom={draft.backgroundOpacity !== null}
            onChange={(v) => update({ backgroundOpacity: v })}
            onReset={() => update({ backgroundOpacity: null })}
          />
          <div className="flex items-center justify-between text-[12px] text-white/75">
            Cantos chanfrados
            <button
              type="button"
              aria-pressed={themed.chamfer}
              onClick={() => update({ chamfer: !themed.chamfer })}
              className={chip(themed.chamfer)}
            >
              {themed.chamfer ? "Ligado" : "Desligado"}
            </button>
          </div>
        </div>
      </Section>

      <button
        type="button"
        onClick={() =>
          update({
            useThemeStyle: true,
            cornerRadius: null,
            glowIntensity: null,
            backgroundOpacity: null,
            chamfer: null,
          })
        }
        className="self-start text-[12px] rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-white"
      >
        Restaurar visual
      </button>
    </div>
  );
};
