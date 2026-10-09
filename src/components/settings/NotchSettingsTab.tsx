import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Switch } from "../ui/switch";
import { cn } from "../../lib/utils";
import { usePreferences } from "../../context/PreferencesContext";
import { useSoundEffects } from "../../hooks/useSoundEffects";
import { MASCOT_MOODS, PherieMascot, getMascotBaseMood, setMascotBaseMood, type MascotMood } from "../notch/PherieMascot";
import { normalizeHex } from "../../mascot/mascotColor";
import {
  DEFAULT_NOTCH_CONFIG,
  NOTCH_BODY_PRESETS,
  type NotchConfig,
} from "../../mascot/notchConfig";
import { saveNotchConfig, useNotchConfig } from "../../mascot/useNotchConfig";
import { MascotCustomizer } from "../../mascot/MascotCustomizer";

/** Linha de configuração (mesma aparência do `SettingsRow` da página; copiada para não criar import circular). */
const Row: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  hasBorder?: boolean;
  disabled?: boolean;
}> = ({ title, description, action, children, hasBorder = true, disabled = false }) => (
  <div className={cn("py-3.5", hasBorder && "border-b border-[var(--border-subtle)]", disabled && "opacity-45")}>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-h-[38px]">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-white/90 tracking-wide">{title}</div>
        {description && <p className="text-[11.5px] leading-relaxed text-white/45 mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2.5">{action}</div>}
    </div>
    {children && <div className="mt-2.5">{children}</div>}
  </div>
);

const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
    <h3 className="text-white text-[14px] font-semibold">{title}</h3>
    {hint && <p className="text-[12px] text-white/50 leading-relaxed mt-1">{hint}</p>}
    <div className="mt-3">{children}</div>
  </div>
);

/** Mascote que só anima quando o mouse está em cima (a grade tem 30+ instâncias). */
const HoverMascot: React.FC<React.ComponentProps<typeof PherieMascot>> = (props) => {
  const [hover, setHover] = useState(false);
  return (
    <span onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className="inline-flex">
      <PherieMascot {...props} paused={!hover} isHovered={hover} />
    </span>
  );
};

/** Prévia fiel da barra do notch com a configuração atual. */
const NotchPreview: React.FC<{ config: NotchConfig; mood: MascotMood }> = ({ config, mood }) => (
  <div className="relative h-[64px] w-[210px]">
    {config.enabled ? (
      <div className="absolute left-1/2 top-0 flex h-10 w-[178px] -translate-x-1/2 items-center rounded-b-[14px] bg-black px-3">
        <div className="flex flex-1 items-center">
          {config.showMascot && (
            <PherieMascot size={26} mood={mood} bodyColor={config.bodyColor} shape={config.shape} />
          )}
        </div>
        <span className="text-[13px] font-semibold tabular-nums text-white">{config.showClock ? "17:30" : ""}</span>
        <div className="flex-1" />
      </div>
    ) : (
      <div className="absolute inset-x-0 top-3 text-center text-[11px] text-white/40">Notch desativado</div>
    )}
  </div>
);

export const NotchSettingsTab: React.FC = () => {
  const { effectsVolume, soundTheme } = usePreferences();
  const { playSound } = useSoundEffects(effectsVolume / 100, soundTheme);

  const live = useNotchConfig();
  const [draft, setDraft] = useState<NotchConfig>(live);
  const draftRef = useRef<NotchConfig>(live);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chegou config de fora (disco/evento) e não há edição pendente: adota.
  useEffect(() => {
    if (saveTimer.current) return;
    draftRef.current = live;
    setDraft(live);
  }, [live]);

  // Ao sair da aba, grava o que ficou pendente.
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void saveNotchConfig(draftRef.current);
      }
    },
    [],
  );

  const update = useCallback((patch: Partial<NotchConfig>) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    // arrastar o seletor de cor dispara dezenas de eventos: grava só o último
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void saveNotchConfig(draftRef.current);
    }, 150);
  }, []);

  const [hexText, setHexText] = useState(draft.bodyColor ?? "");
  useEffect(() => setHexText(draft.bodyColor ?? ""), [draft.bodyColor]);

  const [appliedMood, setAppliedMood] = useState<MascotMood | null>(() => getMascotBaseMood());
  const previewMood: MascotMood = appliedMood ?? "idle";
  const off = !draft.enabled;

  const toggle = (key: keyof NotchConfig, extra?: () => void) => (checked: boolean) => {
    update({ [key]: checked } as Partial<NotchConfig>);
    extra?.();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <section>
        <div className="flex items-center gap-2.5 mb-4">
          <Sparkles className="h-4 w-4 text-white/70 shrink-0" />
          <h2 className="text-[17px] font-semibold text-white tracking-wide">Mascote e Notch</h2>
        </div>

        {/* Prévia + interruptor mestre */}
        <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <div className="p-6 md:w-1/2 border-b md:border-b-0 md:border-r border-white/[0.06]">
              <h3 className="text-white text-[14px] font-semibold mb-2">Notch do overlay</h3>
              <p className="text-[12px] text-white/50 leading-relaxed mb-3">
                A barra no topo da tela com a Pherie, o relógio, a música do PC e os controles de chamada. Personalize
                tudo ou desative.
              </p>
              <div className="flex items-center gap-3">
                <Switch checked={draft.enabled} onCheckedChange={toggle("enabled")} />
                <span className="text-[12px] text-white/60">{draft.enabled ? "Ativado" : "Desativado"}</span>
              </div>
              {off && (
                <p className="mt-3 text-[11.5px] leading-relaxed text-amber-200/70">
                  Com o notch desativado, uma pílula mínima de chamada (mutar, silenciar, desconectar) continua
                  aparecendo durante as chamadas. Toasts e o atalho do overlay não mudam.
                </p>
              )}
            </div>
            <div className="p-6 md:w-1/2 flex items-center justify-center bg-black/20">
              <NotchPreview config={draft} mood={previewMood} />
            </div>
          </div>
        </div>

        <Card title="Comportamento">
          <div className={cn(off && "pointer-events-none")}>
            <Row
              disabled={off}
              title="Esconder quando outro app está em primeiro plano"
              description="O notch some e reaparece ao encostar o mouse no topo. Nunca se esconde durante chamadas ou jogos."
              action={<Switch checked={draft.autoHide} onCheckedChange={toggle("autoHide")} disabled={off} />}
            />
            <Row
              disabled={off}
              title="Expandir ao passar o mouse"
              description="Desligado: o notch só expande ao clicar."
              action={<Switch checked={draft.expandOnHover} onCheckedChange={toggle("expandOnHover")} disabled={off} />}
            />
            <Row
              disabled={off}
              title="Mostrar relógio"
              action={<Switch checked={draft.showClock} onCheckedChange={toggle("showClock")} disabled={off} />}
            />
            <Row
              disabled={off}
              title="Mostrar música do PC"
              description="Capa, título e controles da mídia que está tocando (Spotify, navegador, etc.)."
              action={<Switch checked={draft.showMedia} onCheckedChange={toggle("showMedia")} disabled={off} />}
            />
            <Row
              disabled={off}
              title="Sons do notch"
              description="Um som diferente para abrir/fechar, play/pause/pular e cutucar a Pherie (usa o volume dos efeitos)."
              action={<Switch checked={draft.sounds} onCheckedChange={toggle("sounds")} disabled={off} />}
            />
            <Row
              disabled={off}
              hasBorder={false}
              title="Balão de dicas da Pherie"
              description="Frases e dicas no painel expandido quando não há nada tocando."
              action={<Switch checked={draft.showBubbleTips} onCheckedChange={toggle("showBubbleTips")} disabled={off} />}
            />
          </div>
        </Card>
      </section>

      <section className={cn("space-y-6", off && "opacity-60")}>
        <Card title="Pherie">
          <Row
            title="Mostrar a Pherie"
            action={<Switch checked={draft.showMascot} onCheckedChange={toggle("showMascot")} disabled={off} />}
          />
          <Row
            hasBorder={false}
            title="Seguir o cursor"
            description="Os olhos e a cabeça acompanham o mouse."
            action={
              <Switch
                checked={draft.followCursor}
                onCheckedChange={toggle("followCursor")}
                disabled={off || !draft.showMascot}
              />
            }
          />

          <div className="mt-5">
            <div className="text-[13px] font-medium text-white/90 mb-2.5">Cor do corpo</div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {NOTCH_BODY_PRESETS.map(({ hex, label }) => {
                const selected = draft.bodyColor === hex;
                return (
                  <button
                    key={label}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={selected}
                    onClick={() => {
                      update({ bodyColor: hex });
                      playSound("hover");
                    }}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all cursor-pointer",
                      selected ? "border-white scale-110 shadow-lg shadow-white/10" : "border-transparent hover:scale-105",
                    )}
                    style={hex ? { backgroundColor: hex } : { backgroundImage: "linear-gradient(#34343a,#16161a)" }}
                  />
                );
              })}
              <label
                title="Cor personalizada"
                className="relative h-8 w-8 rounded-full border-2 border-white/25 cursor-pointer overflow-hidden hover:scale-105 transition-transform"
                style={{ backgroundImage: "conic-gradient(#e8483f,#f0b429,#3ecf8e,#3b93f0,#8b5cf6,#e152b0,#e8483f)" }}
              >
                <input
                  type="color"
                  aria-label="Cor personalizada"
                  value={draft.bodyColor ?? "#3b93f0"}
                  onChange={(e) => update({ bodyColor: normalizeHex(e.target.value, null) })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <input
                type="text"
                inputMode="text"
                spellCheck={false}
                placeholder="#RRGGBB"
                value={hexText}
                onChange={(e) => {
                  const text = e.target.value;
                  setHexText(text);
                  const hex = normalizeHex(text, null);
                  if (hex) update({ bodyColor: hex });
                  else if (text.trim() === "") update({ bodyColor: null });
                }}
                className="h-8 w-[96px] rounded-lg border border-white/10 bg-white/[0.04] px-2.5 font-mono text-[12px] text-white/80 outline-none focus:border-white/30"
              />
            </div>
            <p className="mt-2 text-[11.5px] text-white/40">
              O rosto e o fone se ajustam sozinhos para continuar legíveis em qualquer cor.
            </p>
          </div>
        </Card>

        <Card
          title="Expressões da Pherie"
          hint="Clique em uma expressão para aplicar no mascote do notch. Passe o mouse sobre o Pherie para animá-lo."
        >
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMascotBaseMood(null);
                setAppliedMood(null);
                playSound("hover");
              }}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all cursor-pointer",
                appliedMood === null
                  ? "border-white/40 bg-white/[0.08]"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:scale-[1.03]",
              )}
              title="Automático"
            >
              <span className="text-lg leading-none">✨</span>
              <span className="text-[10px] font-medium text-white/60 leading-none">Automático</span>
            </button>
            {MASCOT_MOODS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMascotBaseMood(id);
                  setAppliedMood(id);
                  playSound("hover");
                }}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all cursor-pointer",
                  appliedMood === id
                    ? "border-white/40 bg-white/[0.08]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:scale-[1.03]",
                )}
                title={label}
              >
                <HoverMascot size={40} mood={id} bodyColor={draft.bodyColor} shape={draft.shape} />
                <span className="text-[10px] font-medium text-white/60 leading-none">{label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Visual avançado" hint="Chapéu, itens, balão de fala e o estilo do notch (cantos, brilho, opacidade).">
          <MascotCustomizer />
        </Card>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              update({ ...DEFAULT_NOTCH_CONFIG });
              setMascotBaseMood(null);
              setAppliedMood(null);
              playSound("hover");
            }}
            className="text-[12px] bg-white/10 hover:bg-white/20 px-3.5 py-1.5 rounded-xl text-white font-medium transition-colors"
          >
            Restaurar padrão
          </button>
        </div>
      </section>
    </div>
  );
};
