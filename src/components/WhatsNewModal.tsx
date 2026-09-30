import React from "react";
import {
  Check,
  X,
  ExternalLink,
  Sparkles,
  Zap,
  ShieldCheck,
  Layers,
  Gamepad2,
  ArrowRight,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import ModalShell from "./ui/ModalShell";
import { useGamepadButton } from "../context/GamepadContext";
import type { ReleaseHighlights } from "../releases/releaseHighlights";
import desktopIcon from "../assets/Pherielium_Desktop_icon.png";

/**
 * WhatsNewModal with Bento Grid Layout
 * Inspired by @avanishverma4/bento-grid-01 (21st.dev).
 * Complies with Apple front-end guidelines (Noir Housty, Asfalto Urbano,
 * squircle cards, bevel light finish, spring physics).
 */

interface WhatsNewModalProps {
  release: ReleaseHighlights;
  onClose: () => void;
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  ui: <Layers className="w-5 h-5 text-sky-400" />,
  stability: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
  security: <Zap className="w-5 h-5 text-amber-400" />,
  controller: <Gamepad2 className="w-5 h-5 text-purple-400" />,
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", bounce: 0, duration: 0.38 },
  },
};

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ release, onClose }) => {
  useGamepadButton("X", onClose, true, 260);
  useGamepadButton("O", onClose, true, 260);

  const openReleaseNotes = async () => {
    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(release.releaseUrl);
      return;
    }
    window.open(release.releaseUrl, "_blank", "noopener,noreferrer");
  };

  const primaryHighlight = release.highlights[0];
  const secondaryHighlights = release.highlights.slice(1);

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      maxWidthClassName="max-w-[780px] lg:max-w-[820px]"
      zIndexClassName="z-[260]"
      backdropClassName="bg-black/85 backdrop-blur-xl"
      ariaLabel={`Novidades da versão ${release.version}`}
      gamepadPriority={260}
      className="overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0E0E10] p-0 shadow-[0_36px_100px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <div className="relative p-6 sm:p-8 overflow-hidden select-none">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-white/[0.04] blur-3xl pointer-events-none rounded-full" />

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="relative flex items-start justify-between gap-4 pb-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={desktopIcon}
                alt="Pherielium"
                className="w-14 h-14 rounded-2xl object-cover shadow-[0_8px_24px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] border border-white/10"
                draggable={false}
              />
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-[9px] font-bold text-black font-mono uppercase tracking-wider">
                v{release.version}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono text-white/60 uppercase tracking-widest">
                  DESTAQUES DA ATUALIZAÇÃO
                </span>
              </div>
              <h2 className="mt-1 text-xl sm:text-2xl font-display font-bold tracking-tight text-white">
                {release.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar novidades"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── BENTO GRID 01 ────────────────────────────────────────────────── */}
        <motion.div
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.08 }}
          className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3.5"
        >
          {/* Bento Card 1: Hero Card (Col Span 2) */}
          {primaryHighlight && (
            <motion.div
              variants={itemVariants}
              className="md:col-span-2 relative overflow-hidden rounded-[24px] bg-[#161618] border border-white/[0.07] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/15 transition-all group"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-white/[0.03] to-transparent rounded-bl-full pointer-events-none" />

              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08]">
                  {FEATURE_ICONS[primaryHighlight.id] || <Sparkles className="w-5 h-5 text-amber-300" />}
                </div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                  Principal Novidade
                </span>
              </div>

              <h3 className="text-lg font-display font-semibold text-white tracking-tight group-hover:text-white transition-colors">
                {primaryHighlight.title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm font-body text-white/60 leading-relaxed">
                {primaryHighlight.description}
              </p>

              {/* Decorative mini status pills */}
              <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.05]">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-medium">
                  <Check className="w-3 h-3" />
                  Pronto para uso
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 text-[11px] font-mono">
                  Sincronização Ativa
                </span>
              </div>
            </motion.div>
          )}

          {/* Bento Card 2: Hub Integration (Col Span 1) */}
          <motion.div
            variants={itemVariants}
            className="md:col-span-1 relative overflow-hidden rounded-[24px] bg-[#161618] border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/15 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <Gamepad2 className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/80 bg-purple-500/10 px-2 py-0.5 rounded-full">
                  Overlay & Gamepad
                </span>
              </div>
              <h3 className="text-base font-display font-semibold text-white tracking-tight">
                Controles Nativos
              </h3>
              <p className="mt-1.5 text-xs font-body text-white/50 leading-relaxed">
                Navegação total pelo controle (PS5, Xbox, genéricos) e teclado virtual integrado.
              </p>
            </div>

            <div className="mt-4 text-[11px] font-mono text-white/35 flex items-center gap-1">
              <span>Atalho:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70">Shift + Tab</kbd>
            </div>
          </motion.div>

          {/* Remaining highlights mapped to Bento cells */}
          {secondaryHighlights.map((highlight, idx) => (
            <motion.div
              key={highlight.id || idx}
              variants={itemVariants}
              className={`${
                idx === 0 && secondaryHighlights.length === 2 ? "md:col-span-2" : "md:col-span-1"
              } relative overflow-hidden rounded-[24px] bg-[#161618] border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/15 transition-all`}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                  {FEATURE_ICONS[highlight.id] || <Sparkles className="w-4 h-4 text-white/70" />}
                </div>
                <h4 className="text-sm font-display font-semibold text-white tracking-tight">
                  {highlight.title}
                </h4>
              </div>
              <p className="text-xs font-body text-white/55 leading-relaxed">
                {highlight.description}
              </p>
            </motion.div>
          ))}

          {/* Bento Card: Unified Libraries Strip if space remains */}
          <motion.div
            variants={itemVariants}
            className="md:col-span-3 relative overflow-hidden rounded-[20px] bg-[#121214] border border-white/[0.05] p-3.5 flex items-center justify-between text-xs text-white/45 font-mono"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Multi-Launcher: Steam, Epic Games, GOG, EA, Ubisoft, Battle.net, Riot & Jogos Locais</span>
            </div>
            <span className="hidden sm:inline text-white/30">Totalmente integrado</span>
          </motion.div>
        </motion.div>

        {/* ── FOOTER ACTIONS ───────────────────────────────────────────────── */}
        <div className="mt-7 pt-5 border-t border-white/[0.06] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void openReleaseNotes()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-white/70 hover:text-white text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          >
            <span>Ver Notas Completas no GitHub</span>
            <ExternalLink size={13} className="opacity-60" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-semibold shadow-[0_4px_16px_rgba(255,255,255,0.15)] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span>Continuar para o Hub</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default WhatsNewModal;
