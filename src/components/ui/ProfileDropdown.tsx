/**
 * Menu da conta (canto superior direito da Home).
 *
 * O desenho e o comportamento vêm do "Account Menu" do KokonutUI (MIT,
 * © 2025 kokonutUI, autoria @dorianbaffier, https://github.com/kokonut-labs/kokonutui):
 * o painel nasce do próprio retângulo do botão e cresce por mola (um clip-path, sem layout por
 * quadro), o avatar viaja do botão para o cabeçalho, o foco anda com as setas e o mouse
 * compartilha o mesmo destaque, e "Sair" exige segurar o botão.
 * Aqui foi adaptado ao Pherielium: tokens de design do app, framer-motion, SF Symbols, um só
 * perfil (sem troca de conta nem tema) e o cartão de nível/XP que já existia.
 * O aviso de licença completo está em docs/third-party-notices.md.
 */
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, type Transition } from "framer-motion";

import type { LauncherLanguage } from "../../context/PreferencesContext";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { SfSymbol, type SfSymbolName } from "../../design-system/sf-symbols";
import { Squircle } from "./Squircle";
import { getPSNTierInfo, type PlayerLevelInfo } from "../../utils/trophyTiers";

interface ProfileDropdownProps {
  userDisplay: string;
  email?: string;
  avatarUrl?: string;
  userLevel?: PlayerLevelInfo | number;
  onLogout: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  language?: LauncherLanguage;
  playSound: (type: SoundEffectType) => void;
}

const dropdownCopy = {
  "pt-BR": { identity: "Identidade", profile: "Ver perfil", settings: "Configurações", logout: "Sair", hold: "Segure", keepHolding: "Continue segurando", holdHint: ", segure para confirmar", level: "Nível" },
  "en-US": { identity: "Identity", profile: "View profile", settings: "Settings", logout: "Sign out", hold: "Hold", keepHolding: "Keep holding", holdHint: ", press and hold to confirm", level: "Level" },
  "es-ES": { identity: "Identidad", profile: "Ver perfil", settings: "Configuración", logout: "Salir", hold: "Mantén", keepHolding: "Sigue manteniendo", holdHint: ", mantén pulsado para confirmar", level: "Nivel" },
  "fr-FR": { identity: "Identité", profile: "Voir le profil", settings: "Paramètres", logout: "Se déconnecter", hold: "Maintenez", keepHolding: "Continuez", holdHint: ", maintenez pour confirmer", level: "Niveau" },
  "de-DE": { identity: "Identität", profile: "Profil anzeigen", settings: "Einstellungen", logout: "Abmelden", hold: "Halten", keepHolding: "Weiter halten", holdHint: ", zum Bestätigen gedrückt halten", level: "Stufe" },
  "it-IT": { identity: "Identità", profile: "Vedi profilo", settings: "Impostazioni", logout: "Esci", hold: "Tieni premuto", keepHolding: "Continua a tenere", holdHint: ", tieni premuto per confermare", level: "Livello" },
} as const;

const PANEL_W = 288;
const RADIUS = 16;
const HOLD_MS = 900;
const SPRING: Transition = { type: "spring", duration: 0.3, bounce: 0 };
const INSTANT: Transition = { duration: 0 };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type Phase = "closed" | "open" | "closing";
type Via = "pointer" | "keyboard";

const ITEM_CLASS =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left text-[length:var(--step-1)] font-semibold text-[var(--ink-muted)] outline-none transition-colors duration-100 focus:bg-[var(--tone-3)] focus:text-[var(--ink)]";

/** Um clique disparado por Enter/Espaço não traz detalhe de ponteiro. */
const viaOf = (event: React.MouseEvent): Via => (event.detail === 0 ? "keyboard" : "pointer");

const menuItems = (root: HTMLElement | null): HTMLElement[] =>
  root ? Array.from(root.querySelectorAll<HTMLElement>("[data-menu-item]")) : [];

/** Próximo item para as setas: a lista é uma coluna só, então é cima/baixo com volta. */
function nextItem(items: HTMLElement[], active: Element | null, key: string): HTMLElement | undefined {
  if (key === "Home") return items[0];
  if (key === "End") return items.at(-1);
  const index = items.findIndex((item) => item === active);
  if (index === -1) return key === "ArrowUp" ? items.at(-1) : items[0];
  const step = key === "ArrowDown" ? 1 : -1;
  return items[(index + step + items.length) % items.length];
}

function Avatar({ name, url, className }: { name: string; url?: string; className: string }) {
  return (
    <Squircle
      cornerRadius={12}
      cornerSmoothing={1}
      className={`relative shrink-0 aspect-square overflow-hidden bg-[var(--tone-3)] ${className}`}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover object-center" draggable={false} />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs font-black text-[var(--ink-muted)]">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </Squircle>
  );
}

/** Linha que só confirma depois de segurar: um preenchimento invertido corre da esquerda para a direita. */
function HoldRow({
  label,
  hold,
  keepHolding,
  hint,
  icon,
  onComplete,
}: {
  label: string;
  hold: string;
  keepHolding: string;
  hint: string;
  icon: SfSymbolName;
  onComplete: (via: Via) => void;
}) {
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const [nudge, setNudge] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const nudgeTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(nudgeTimer.current);
    },
    [],
  );

  const start = (via: Via) => {
    if (timer.current !== undefined || done) return;
    window.clearTimeout(nudgeTimer.current);
    setNudge(false);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setHolding(false);
      setDone(true);
      onComplete(via);
    }, HOLD_MS);
  };

  const cancel = () => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
    // soltou cedo: avisa que é preciso segurar
    setNudge(true);
    nudgeTimer.current = window.setTimeout(() => setNudge(false), 1400);
  };

  const content = (
    <>
      <SfSymbol name={icon} size={16} />
      <span className="flex-1">{label}</span>
      <span className="text-[length:var(--step-0)] opacity-70">{nudge ? keepHolding : hold}</span>
    </>
  );

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      data-menu-item=""
      className={`${ITEM_CLASS} relative touch-none select-none text-[var(--ink-muted)]`}
      onBlur={cancel}
      onClick={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (!event.repeat) start("keyboard");
      }}
      onKeyUp={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        cancel();
      }}
      onPointerCancel={cancel}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        start("pointer");
      }}
      onPointerUp={cancel}
    >
      {content}
      <span className="sr-only">{hint}</span>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center gap-2.5 rounded-[10px] bg-[var(--ink)] px-2.5 text-[var(--tone-0)]"
        style={{
          clipPath: holding || done ? "inset(0 0 0 0 round 10px)" : "inset(0 100% 0 0 round 10px)",
          transition: holding ? `clip-path ${HOLD_MS}ms linear` : "clip-path 240ms cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        {content}
      </span>
    </button>
  );
}

export function ProfileDropdown({
  userDisplay,
  email,
  avatarUrl,
  userLevel,
  onLogout,
  onOpenProfile,
  onOpenSettings,
  language = "pt-BR",
  playSound,
}: ProfileDropdownProps) {
  const uid = useId();
  const reduced = useReducedMotion() === true;
  const copy = dropdownCopy[language] || dropdownCopy["pt-BR"];
  const [phase, setPhase] = useState<Phase>("closed");
  const [instant, setInstant] = useState(false);
  const [openSeq, setOpenSeq] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("closed");
  phaseRef.current = phase;
  const openFocus = useRef<"first" | "last" | "menu">("menu");
  const closeSeq = useRef(0);
  const targetH = useRef(0);

  // Caixa visível do painel: as duas camadas de superfície (borda e fundo) e o conteúdo são
  // recortados por ela, então o menu cresce do retângulo do botão sem layout a cada quadro.
  const w = useMotionValue(0);
  const h = useMotionValue(0);
  const bodyOpacity = useMotionValue(1);
  const outerClip = useMotionTemplate`inset(0px 0px calc(100% - ${h}px) calc(100% - ${w}px) round ${RADIUS}px)`;
  const innerClip = useMotionTemplate`inset(1px 1px calc(100% - ${h}px + 1px) calc(100% - ${w}px + 1px) round ${RADIUS - 1}px)`;

  const levelInfo = useMemo<PlayerLevelInfo | null>(() => {
    if (!userLevel) return null;
    if (typeof userLevel === "number") {
      const tierInfo = getPSNTierInfo(userLevel);
      return {
        level: userLevel,
        xp: 0,
        progress: 0,
        currentLevelXp: 0,
        xpForNextLevel: 100,
        tier: tierInfo.tier,
        subTier: tierInfo.subTier,
        tierName: tierInfo.name,
        rank: tierInfo.name,
        rankColor: tierInfo.color,
        tierInfo,
      };
    }
    return userLevel;
  }, [userLevel]);

  const levelNum = levelInfo?.level;
  const tierInfo = useMemo(
    () => levelInfo?.tierInfo || (levelNum ? getPSNTierInfo(levelNum) : getPSNTierInfo(1)),
    [levelInfo, levelNum],
  );

  const sharedTransition = instant ? INSTANT : SPRING;
  const isOpen = phase === "open";
  const menuId = `${uid}-menu`;

  const openMenu = (via: Via, focus: "first" | "last" | "menu") => {
    if (phaseRef.current === "open") return;
    openFocus.current = focus;
    closeSeq.current += 1;
    setInstant(via === "keyboard" || reduced);
    setPhase("open");
    setOpenSeq((seq) => seq + 1);
    playSound("select");
  };

  const closeMenu = (via: Via, returnFocus: boolean) => {
    if (phaseRef.current !== "open") return;
    const trigger = triggerRef.current;
    if (returnFocus) trigger?.focus({ preventScroll: true });
    playSound("back");
    if (via === "keyboard" || reduced || !trigger) {
      setInstant(true);
      setPhase("closed");
      return;
    }
    setInstant(false);
    setPhase("closing");
    const seq = ++closeSeq.current;
    animate(bodyOpacity, 0, { duration: 0.12, ease: EASE_OUT });
    animate(w, trigger.offsetWidth, SPRING);
    animate(h, trigger.offsetHeight, SPRING).then(() => {
      if (closeSeq.current === seq) setPhase("closed");
    });
  };

  const select = (event: React.MouseEvent, run?: () => void) => {
    run?.();
    closeMenu(viaOf(event), true);
  };

  // Abrindo: o recorte começa do tamanho do botão e se abre até o do menu. Pelo teclado, pula
  // direto para o fim.
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const main = mainRef.current;
    if (openSeq === 0 || phaseRef.current !== "open" || !trigger || !main) return;
    targetH.current = main.offsetHeight;
    if (instant) {
      w.jump(PANEL_W);
      h.jump(targetH.current);
      bodyOpacity.jump(1);
    } else {
      w.jump(trigger.offsetWidth);
      h.jump(trigger.offsetHeight);
      bodyOpacity.jump(0);
      animate(w, PANEL_W, SPRING);
      animate(h, targetH.current, SPRING);
      animate(bodyOpacity, 1, { duration: 0.2, delay: 0.05, ease: EASE_OUT });
    }
    const list = menuItems(main);
    const target = { first: list[0], last: list.at(-1), menu: main.querySelector<HTMLElement>("[role=menu]") }[openFocus.current];
    target?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma vez por abertura
  }, [openSeq]);

  // Mantém a altura em dia se o conteúdo mudar de tamanho com o menu aberto (ex.: o XP carrega).
  useEffect(() => {
    if (phase !== "open" || !mainRef.current) return;
    const el = mainRef.current;
    const observer = new ResizeObserver(() => {
      if (phaseRef.current !== "open") return;
      const next = el.offsetHeight;
      if (Math.abs(next - targetH.current) < 0.5) return;
      targetH.current = next;
      animate(h, next, reduced ? INSTANT : SPRING);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [phase, h, reduced]);

  // Um toque fora fecha, com a animação de volta ao botão.
  useEffect(() => {
    if (phase !== "open") return;
    const onDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) closeMenu("pointer", false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeMenu só lê refs
  }, [phase]);

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      closeMenu("keyboard", true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    nextItem(menuItems(mainRef.current), document.activeElement, event.key)?.focus({ preventScroll: true });
  };

  // Passar o mouse por um item o foca: mouse e teclado compartilham um destaque só.
  const onPanelPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const item = (event.target as HTMLElement).closest<HTMLElement>("[data-menu-item]");
    if (item && document.activeElement !== item) {
      item.focus({ preventScroll: true });
      playSound("hover");
    }
  };

  return (
    <div ref={wrapperRef} className={`font-ui relative isolate inline-block ${phase !== "closed" ? "z-50" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        data-tour="profile"
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onPointerEnter={() => playSound("hover")}
        onClick={(event) => {
          const via = viaOf(event);
          openMenu(via, via === "keyboard" ? "first" : "menu");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu("keyboard", event.key === "ArrowDown" ? "first" : "last");
          }
        }}
        className="group flex cursor-pointer items-center gap-[var(--gap-inline)] rounded-[var(--radius-control)] p-1 -m-1 outline-none transition-[background-color,transform] duration-[var(--dur-focus)] ease-[var(--ease-focus)] hover:bg-white/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-white/20"
      >
        <div className="flex flex-col items-end whitespace-nowrap pl-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[length:var(--fs-label)] font-black uppercase leading-tight tracking-widest text-[var(--ink-muted)]">
              {copy.identity}
            </span>
            {levelNum != null && (
              <span className={`text-[length:var(--fs-label)] font-black uppercase leading-tight tracking-wider ${tierInfo.color}`}>
                • Nv. {levelNum}
              </span>
            )}
          </div>
          <span className="text-[length:var(--fs-caption)] font-black uppercase leading-tight text-white">{userDisplay}</span>
        </div>
        {/* O avatar viaja do botão para o cabeçalho do menu (mesmo layoutId) */}
        <motion.span
          layoutId={isOpen ? undefined : `${uid}-avatar`}
          transition={sharedTransition}
          className={`block h-[var(--control-h)] w-[var(--control-h)] ${isOpen ? "invisible" : ""}`}
        >
          <Avatar name={userDisplay} url={avatarUrl} className="h-full w-full ring-2 ring-white/10 transition-transform group-hover:scale-105 group-hover:ring-white/30" />
        </motion.span>
      </button>

      {phase !== "closed" && (
        <div className="pointer-events-none absolute right-0 top-0 z-10" style={{ width: PANEL_W }}>
          <div aria-hidden="true" className="absolute inset-0 [filter:drop-shadow(0_16px_32px_rgb(0_0_0/0.55))]">
            <motion.div className="absolute inset-0 bg-[var(--tone-4)]" style={{ clipPath: outerClip }} />
            <motion.div className="absolute inset-0 bg-[var(--tone-2)]" style={{ clipPath: innerClip }} />
          </div>
          <motion.div
            className={`relative ${isOpen ? "pointer-events-auto" : ""}`}
            onKeyDown={onPanelKeyDown}
            onPointerMove={onPanelPointerMove}
            style={{ clipPath: innerClip }}
          >
            <div ref={mainRef} className="p-1.5" style={{ width: PANEL_W }}>
              <div className="flex items-start justify-between gap-3 px-2.5 pb-3 pt-2.5">
                <div className="flex min-w-0 flex-col items-start gap-3">
                  <motion.span layoutId={isOpen ? `${uid}-avatar` : undefined} transition={sharedTransition} className={`block h-11 w-11 ${isOpen ? "" : "invisible"}`}>
                    <Avatar name={userDisplay} url={avatarUrl} className="h-full w-full" />
                  </motion.span>
                  <motion.span className="flex min-w-0 flex-col" style={{ opacity: bodyOpacity }}>
                    <span className="truncate text-[length:var(--step-1)] font-black leading-5 text-[var(--ink)]">{userDisplay}</span>
                    {email && <span className="truncate text-[length:var(--step-0)] leading-4 text-[var(--ink-faint)]">{email}</span>}
                  </motion.span>
                </div>
                {levelNum != null && (
                  <motion.span
                    style={{ opacity: bodyOpacity }}
                    className={`shrink-0 rounded-lg border px-2 py-0.5 text-[length:var(--step-0)] font-black uppercase tracking-wider ${tierInfo.bgClass} ${tierInfo.borderClass} ${tierInfo.color}`}
                  >
                    Nv. {levelNum}
                  </motion.span>
                )}
              </div>

              <motion.div id={menuId} role="menu" aria-label={userDisplay} tabIndex={-1} className="outline-none" style={{ opacity: bodyOpacity }}>
                {levelInfo && (
                  <div className="mx-1 mb-1.5 space-y-1.5 rounded-xl bg-[var(--tone-3)] p-2.5">
                    <div className="flex items-center justify-between text-[length:var(--step-0)]">
                      <span className={`font-bold ${tierInfo.color}`}>{tierInfo.name}</span>
                      <span className="font-metric font-semibold text-[var(--ink-muted)]">
                        {levelInfo.currentLevelXp} / {levelInfo.xpForNextLevel} XP
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${levelInfo.progress}%`, backgroundColor: tierInfo.hexColor || "#38bdf8" }}
                      />
                    </div>
                  </div>
                )}

                {(onOpenProfile || onOpenSettings) && <hr className="mx-2.5 my-1.5 h-px border-0 bg-white/10" />}
                {onOpenProfile && (
                  <button type="button" role="menuitem" tabIndex={-1} data-menu-item="" className={ITEM_CLASS} onClick={(event) => select(event, onOpenProfile)}>
                    <SfSymbol name="person.crop.circle" size={16} />
                    <span className="flex-1">{copy.profile}</span>
                  </button>
                )}
                {onOpenSettings && (
                  <button type="button" role="menuitem" tabIndex={-1} data-menu-item="" className={ITEM_CLASS} onClick={(event) => select(event, onOpenSettings)}>
                    <SfSymbol name="gear" size={16} />
                    <span className="flex-1">{copy.settings}</span>
                  </button>
                )}
                <hr className="mx-2.5 my-1.5 h-px border-0 bg-white/10" />
                <HoldRow
                  label={copy.logout}
                  hold={copy.hold}
                  keepHolding={copy.keepHolding}
                  hint={copy.holdHint}
                  icon="power"
                  onComplete={(via) => {
                    onLogout();
                    closeMenu(via, true);
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
