import React from "react";
import { Check, Gamepad2, Monitor, Power, ShieldCheck } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { useGamepad } from "../context/GamepadContext";
import { useHoldToLaunch } from "../hooks/useHoldToLaunch";
import { ControllerButtonGlyph, type ControllerButtonKey } from "../components/ui/ControllerButtonGlyph";
import { Switch } from "../components/ui/switch";
import { useNotchConfigEditor } from "../mascot/MascotCustomizer";
import { MAX_WEATHER_CITY_LENGTH, NOTCH_WIDGET_OPTIONS } from "../mascot/notchConfig";
import { NotchPreview, type PreviewFocus } from "./NotchPreview";
import type { TourPanel, TourVisual } from "./tourSteps";

/** Ilustrações animadas que ensinam um gesto dentro do cartão da Pherie. Decorativas (aria-hidden). */

const KeyCap: React.FC<{ children: React.ReactNode; wide?: boolean; className?: string }> = ({ children, wide, className = "" }) => (
  <kbd
    className={`inline-flex h-8 items-center justify-center rounded-lg border border-white/25 bg-white/10 px-2.5 text-[length:var(--step-0)] font-semibold text-white shadow-[0_2px_0_rgba(255,255,255,0.12)] ${
      wide ? "min-w-[52px]" : "min-w-[32px]"
    } ${className}`}
  >
    {children}
  </kbd>
);

/** Alt apertado + rolagem da roda do mouse. */
const AltScrollDemo: React.FC = () => (
  <div className="flex items-center justify-center gap-2.5 py-1" aria-hidden>
    <KeyCap wide className="tour-key-alt">
      Alt
    </KeyCap>
    <span className="text-[var(--ink-muted)]">+</span>
    <span className="relative flex h-9 w-6 justify-center rounded-full border-2 border-white/45 pt-1.5">
      <span className="tour-wheel-dot h-2.5 w-[3px] rounded-full bg-white" />
    </span>
  </div>
);

/** O Alt sobe e aparece "solte": é assim que a plataforma escolhida é confirmada. */
const ReleaseAltDemo: React.FC = () => (
  <div className="flex flex-col items-center gap-2 py-1" aria-hidden>
    <KeyCap wide className="tour-release-key">
      Alt
    </KeyCap>
    <span className="tour-release-hint text-[length:var(--step-0)] font-semibold text-white">Solte para confirmar</span>
    <span className="text-[11px] text-[var(--ink-faint)]">ou aperte Enter · Esc cancela</span>
  </div>
);

/** Uma tela em miniatura: o cursor sobe até o topo e a notch abre. */
const NotchHoverDemo: React.FC = () => (
  <div
    className="relative mx-auto h-[116px] w-full max-w-[280px] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#1b2540] to-[#0e1424]"
    aria-hidden
  >
    <div className="tour-notch-box">
      <div className="tour-notch-content">
        <span className="h-7 w-7 rounded-md bg-gradient-to-br from-pink-400/80 to-amber-300/70" />
        <span className="flex-1 space-y-1">
          <span className="block h-1.5 w-14 rounded bg-white/70" />
          <span className="block h-1.5 w-9 rounded bg-white/35" />
        </span>
      </div>
    </div>
    <svg width="18" height="18" viewBox="0 0 24 24" className="tour-notch-cursor">
      <path d="M5 3l14 8-6.2 1.7L10.5 19 5 3z" fill="white" stroke="black" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  </div>
);

/** Plataformas que entram no hub, uma a uma. */
const PLATFORM_NAMES = ["Steam", "Epic", "EA", "Ubisoft", "GOG", "Xbox", "Riot", "Battle.net", "Rockstar", "Locais"];

const PlatformsDemo: React.FC = () => (
  <div className="flex flex-wrap justify-center gap-2 py-1" aria-hidden>
    {PLATFORM_NAMES.map((name, i) => (
      <span
        key={name}
        className="tour-chip-in rounded-full bg-white/[0.08] px-3 py-1 text-[length:var(--step-0)] font-semibold text-white"
        style={{ animationDelay: `${i * 90}ms` }}
      >
        {name}
      </span>
    ))}
  </div>
);

/** O atalho do teclado e o controle, com o botão do meio piscando. */
const OverlayDemo: React.FC = () => (
  <div className="flex flex-col items-center gap-3 py-1" aria-hidden>
    <div className="flex items-center gap-2">
      <KeyCap wide>Ctrl</KeyCap>
      <span className="text-[var(--ink-muted)]">+</span>
      <KeyCap wide>Shift</KeyCap>
      <span className="text-[var(--ink-muted)]">+</span>
      <KeyCap>O</KeyCap>
    </div>
    <span className="text-[length:var(--step-0)] text-[var(--ink-faint)]">ou</span>
    <svg width="190" height="112" viewBox="0 0 190 112" fill="none">
      <path
        d="M52 24h86c18 0 30 10 36 34l8 34c2 9-4 16-13 16-6 0-10-3-14-9l-9-14H44l-9 14c-4 6-8 9-14 9-9 0-15-7-13-16l8-34c6-24 18-34 36-34z"
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2"
      />
      <circle cx="62" cy="52" r="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <circle cx="124" cy="72" r="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <path d="M86 70v10M81 75h10" stroke="rgba(255,255,255,0.4)" strokeWidth="2.4" strokeLinecap="round" />
      {[[134, 44], [144, 54], [124, 54], [134, 64]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="rgba(255,255,255,0.18)" />
      ))}
      {/* botão do meio: Guide / PS */}
      <circle className="tour-center-ring" cx="95" cy="44" r="9" stroke="rgba(255,255,255,0.9)" strokeWidth="2" />
      <circle className="tour-center-dot" cx="95" cy="44" r="5.5" fill="white" />
    </svg>
    <span className="text-[length:var(--step-0)] font-semibold text-white">Botão do meio do controle</span>
  </div>
);

/** O controle do jogador vira um Xbox (XInput) para o jogo, e só enquanto o jogo roda. */
const XInputDemo: React.FC = () => (
  <div className="flex items-center justify-center gap-3 py-1" aria-hidden>
    <span className="flex flex-col items-center gap-1">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.08] text-white">
        <Gamepad2 className="h-6 w-6" />
      </span>
      <span className="text-[11px] font-semibold text-[var(--ink-muted)]">Seu controle</span>
    </span>
    <span className="tour-flow h-[3px] w-14 rounded-full" />
    <span className="flex flex-col items-center gap-1">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[length:var(--step-2)] font-black text-black">X</span>
      <span className="text-[11px] font-semibold text-[var(--ink-muted)]">O jogo vê um Xbox</span>
    </span>
  </div>
);

export const TourVisualView: React.FC<{ visual: TourVisual }> = ({ visual }) => {
  if (visual === "alt-scroll") return <AltScrollDemo />;
  if (visual === "release-alt") return <ReleaseAltDemo />;
  if (visual === "platforms") return <PlatformsDemo />;
  if (visual === "overlay") return <OverlayDemo />;
  if (visual === "xinput") return <XInputDemo />;
  return <NotchHoverDemo />;
};

/* ───────────── painel: comportamento da janela (antiga tela de configuração inicial) ───────────── */

const PrefRow: React.FC<{ icon: React.ReactNode; title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  icon,
  title,
  hint,
  checked,
  onChange,
}) => (
  <li className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-3 py-2.5">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-[var(--ink-muted)]">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[length:var(--step-0)] font-semibold text-white">{title}</span>
      <span className="block text-[11px] leading-snug text-[var(--ink-faint)]">{hint}</span>
    </span>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
  </li>
);

const WindowPrefsCard: React.FC = () => {
  const { minimizeToTrayOnClose, setMinimizeToTrayOnClose, confirmBeforeExit, setConfirmBeforeExit, openAtLogin, setOpenAtLogin } = usePreferences();
  return (
    <ul className="mt-2 space-y-2">
      <PrefRow
        icon={<Monitor className="h-4 w-4" />}
        title="Minimizar para a bandeja"
        hint="Fechar a janela oculta o app em vez de encerrar."
        checked={minimizeToTrayOnClose}
        onChange={setMinimizeToTrayOnClose}
      />
      <PrefRow
        icon={<ShieldCheck className="h-4 w-4" />}
        title="Confirmar antes de sair"
        hint="Pede confirmação ao encerrar o aplicativo."
        checked={confirmBeforeExit}
        onChange={setConfirmBeforeExit}
      />
      <PrefRow
        icon={<Power className="h-4 w-4" />}
        title="Iniciar com o Windows"
        hint="O Pherielium abre sozinho quando você liga o PC."
        checked={openAtLogin}
        onChange={setOpenAtLogin}
      />
    </ul>
  );
};

/* ───────────── painel: configurar a notch no tutorial ───────────── */

const NotchSetupCard: React.FC = () => {
  const { draft, update } = useNotchConfigEditor();
  const [focus, setFocus] = React.useState<PreviewFocus>(null);
  const off = !draft.enabled;
  // o item mexido por último ganha um destaque na prévia por um instante
  const focusTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = (next: PreviewFocus) => {
    setFocus(next);
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocus(null), 2200);
  };
  React.useEffect(() => () => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
  }, []);
  return (
    <div className="mt-2 space-y-3">
      <NotchPreview config={draft} focus={focus} />
      <ul className="space-y-2">
        <PrefRow
          icon={<Monitor className="h-4 w-4" />}
          title="Usar a notch"
          hint="Música, notificações e o seu jogo no topo da tela."
          checked={draft.enabled}
          onChange={(enabled) => {
            update({ enabled });
            pulse("notch");
          }}
        />
        {NOTCH_WIDGET_OPTIONS.map(({ id, label, description }) => (
          <li key={id} className={off ? "pointer-events-none opacity-40" : undefined}>
            <ul>
              <PrefRow
                icon={<span className="text-[11px] font-bold">{label.slice(0, 1)}</span>}
                title={label}
                hint={description}
                checked={draft.widgets.includes(id)}
                onChange={(checked) => {
                  update({ widgets: checked ? [...draft.widgets, id] : draft.widgets.filter((w) => w !== id) });
                  pulse(id);
                }}
              />
            </ul>
          </li>
        ))}
      </ul>
      {draft.widgets.includes("weather") && !off && (
        <label className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-3 py-2.5">
          <span className="min-w-0 flex-1 text-[length:var(--step-0)] font-semibold text-white">Cidade do clima</span>
          <input
            type="text"
            value={draft.weatherCity}
            maxLength={MAX_WEATHER_CITY_LENGTH}
            placeholder="Ex.: Recife"
            onChange={(e) => update({ weatherCity: e.target.value })}
            className="h-9 w-[170px] rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[length:var(--step-0)] text-white outline-none focus:border-white/30"
          />
        </label>
      )}
      <ul>
        <PrefRow
          icon={<span className="text-[11px] font-bold">P</span>}
          title="Mostrar a Pherie"
          hint="Ela fica no topo do hub, ao lado do relógio."
          checked={draft.showMascot}
          onChange={(showMascot) => {
            update({ showMascot });
            pulse("pherie");
          }}
        />
      </ul>
    </div>
  );
};

/* ───────────── controle: conectar, navegar e segurar X ───────────── */

/** Espera o controle aparecer. A Gamepad API só o enxerga depois do primeiro aperto de botão. */
const ControllerConnectPanel: React.FC<{ onDone: () => void; onNoController: () => void }> = ({ onDone, onNoController }) => {
  const { isGamepadConnected } = useGamepad();
  const doneRef = React.useRef(onDone);
  React.useEffect(() => {
    doneRef.current = onDone;
  });
  React.useEffect(() => {
    if (!isGamepadConnected) return;
    const id = window.setTimeout(() => doneRef.current(), 900);
    return () => window.clearTimeout(id);
  }, [isGamepadConnected]);

  return (
    <div className="mt-2 flex flex-col items-center gap-4">
      <span
        className={`grid h-24 w-24 place-items-center rounded-3xl ${
          isGamepadConnected ? "bg-emerald-400 text-black" : "tour-ring bg-white/[0.06] text-white/80"
        }`}
      >
        {isGamepadConnected ? <Check className="h-11 w-11" strokeWidth={3} /> : <Gamepad2 className="h-11 w-11" />}
      </span>
      <p className="text-[length:var(--step-1)] font-semibold text-white" role="status">
        {isGamepadConnected ? "Controle conectado!" : "Procurando controle…"}
      </p>
      {!isGamepadConnected && (
        <>
          <p className="max-w-[360px] text-center text-[length:var(--step-0)] text-[var(--ink-faint)]">
            Ligue o controle e aperte qualquer botão para eu enxergá-lo.
          </p>
          <button
            type="button"
            onClick={onNoController}
            className="h-10 cursor-pointer rounded-full bg-white/[0.08] px-5 text-[length:var(--step-0)] font-semibold text-white apple-press transition hover:bg-white/[0.14]"
          >
            Não tenho controle no momento
          </button>
        </>
      )}
    </div>
  );
};

const CONTROLLER_LEGEND: { button: ControllerButtonKey; label: string }[] = [
  { button: "DPAD", label: "Navegar" },
  { button: "A", label: "Confirmar" },
  { button: "B", label: "Voltar" },
  { button: "LB", label: "Aba anterior" },
  { button: "RB", label: "Próxima aba" },
  { button: "L2", label: "Plataformas" },
  { button: "R2", label: "Filtros" },
];

/** Conclui quando o direcional ou um analógico se mexe (índices do mapeamento padrão da Gamepad API). */
const ControllerMovePanel: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { gamepadFamily } = useGamepad();
  const doneRef = React.useRef(onDone);
  React.useEffect(() => {
    doneRef.current = onDone;
  });
  React.useEffect(() => {
    let raf = 0;
    let finished = false;
    const poll = () => {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      const moved = pads.some(
        (pad) =>
          pad &&
          ([12, 13, 14, 15].some((i) => pad.buttons[i]?.pressed) || [0, 1, 2, 3].some((i) => Math.abs(pad.axes[i] ?? 0) > 0.6)),
      );
      if (moved && !finished) {
        finished = true;
        doneRef.current();
        return;
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2.5">
      {CONTROLLER_LEGEND.map(({ button, label }) => (
        <li key={button} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-3 py-2">
          <ControllerButtonGlyph button={button} gamepadFamily={gamepadFamily} size={26} />
          <span className="text-[length:var(--step-0)] font-semibold text-white">{label}</span>
        </li>
      ))}
    </ul>
  );
};

/** O botão de iniciar do jogo, de verdade: enche enquanto é segurado e o controle vibra mais perto do fim. */
const ControllerHoldPanel: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { gamepadFamily } = useGamepad();
  const hold = useHoldToLaunch({ onComplete: onDone, enabled: true, canStartFromGamepad: () => true });
  return (
    <div className="mt-2 flex flex-col items-center gap-3">
      <button
        type="button"
        {...hold.pointerHandlers}
        className="relative flex h-14 w-[300px] touch-none select-none items-center justify-between gap-4 overflow-hidden rounded-[var(--corner-md)] bg-white px-6 text-left text-black"
        style={{ transform: hold.holding ? "scale(0.985)" : undefined, transition: "transform 120ms ease-out" }}
      >
        <span className="absolute inset-0 origin-left bg-black/20" style={{ transform: `scaleX(${hold.progress})` }} aria-hidden />
        <span className="relative text-[length:var(--step-0)] font-bold uppercase tracking-[0.06em]">Segure para iniciar</span>
        <span className="relative">
          <ControllerButtonGlyph button="A" gamepadFamily={gamepadFamily} size={24} />
        </span>
      </button>
      <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">Segure o X do controle (ou o botão do mouse).</p>
    </div>
  );
};

export const TourPanelView: React.FC<{
  panel: TourPanel;
  /** o painel concluiu a tarefa do passo */
  onDone?: () => void;
  /** a pessoa disse que não tem controle agora */
  onNoController?: () => void;
}> = ({ panel, onDone = () => undefined, onNoController = () => undefined }) => {
  switch (panel) {
    case "window-prefs":
      return <WindowPrefsCard />;
    case "notch-setup":
      return <NotchSetupCard />;
    case "controller-connect":
      return <ControllerConnectPanel onDone={onDone} onNoController={onNoController} />;
    case "controller-move":
      return <ControllerMovePanel onDone={onDone} />;
    case "controller-hold":
      return <ControllerHoldPanel onDone={onDone} />;
  }
};
