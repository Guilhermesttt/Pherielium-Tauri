import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ModalShell from "../ui/ModalShell";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import {
  LogOut as AnimatedLogOut,
  Trash2 as AnimatedTrash2,
  Unlink as AnimatedUnlink,
  UserMinus as AnimatedUserMinus,
} from "../animate-ui/icons";

export type ConfirmationVariant =
  | "default"
  | "delete"
  | "logout"
  | "disconnect"
  | "unfriend";

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Mantido por compatibilidade — o design unificado escolhe o botão pelo variant. */
  confirmVariant?: "white" | "outline" | "ghost" | "danger";
  variant?: ConfirmationVariant;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  playSound: (type: SoundEffectType) => void;
}

type VariantVisual = {
  Icon: React.ComponentType<{
    size?: number;
    animate?: boolean;
    loop?: boolean;
    className?: string;
  }>;
  iconWrapClass: string;
  iconClass: string;
  confirmClass: string;
  defaultCancel: string;
};

const VARIANT_VISUALS: Record<ConfirmationVariant, VariantVisual> = {
  delete: {
    Icon: AnimatedTrash2,
    iconWrapClass: "bg-rose-500/15 border-rose-500/30 shadow-[0_0_28px_rgba(244,63,94,0.22)]",
    iconClass: "text-rose-400",
    confirmClass:
      "bg-rose-500 text-white shadow-[0_0_28px_rgba(244,63,94,0.45)] hover:bg-rose-400 hover:shadow-[0_0_36px_rgba(244,63,94,0.55)]",
    defaultCancel: "Não, manter",
  },
  logout: {
    Icon: AnimatedLogOut,
    iconWrapClass: "bg-white/10 border-white/20 shadow-[0_0_28px_rgba(255,255,255,0.12)]",
    iconClass: "text-white",
    confirmClass:
      "bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.28)] hover:bg-white/92 hover:shadow-[0_0_32px_rgba(255,255,255,0.4)]",
    defaultCancel: "Não, ficar",
  },
  unfriend: {
    Icon: AnimatedUserMinus,
    iconWrapClass: "bg-amber-500/15 border-amber-500/30 shadow-[0_0_28px_rgba(245,158,11,0.2)]",
    iconClass: "text-amber-400",
    confirmClass:
      "bg-rose-500 text-white shadow-[0_0_28px_rgba(244,63,94,0.45)] hover:bg-rose-400 hover:shadow-[0_0_36px_rgba(244,63,94,0.55)]",
    defaultCancel: "Não, manter",
  },
  disconnect: {
    Icon: AnimatedUnlink,
    iconWrapClass: "bg-sky-500/15 border-sky-500/30 shadow-[0_0_28px_rgba(56,189,248,0.2)]",
    iconClass: "text-sky-400",
    confirmClass:
      "bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.28)] hover:bg-white/92 hover:shadow-[0_0_32px_rgba(255,255,255,0.4)]",
    defaultCancel: "Não, manter",
  },
  default: {
    Icon: AnimatedLogOut,
    iconWrapClass: "bg-white/10 border-white/20 shadow-[0_0_28px_rgba(255,255,255,0.12)]",
    iconClass: "text-white",
    confirmClass:
      "bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.28)] hover:bg-white/92 hover:shadow-[0_0_32px_rgba(255,255,255,0.4)]",
    defaultCancel: "Cancelar",
  },
};

/**
 * Modal de confirmação com mensagem clara (ícone animado → título → descrição → ações).
 * Referência: hierarquia "clear message" — o ícone deixa a intenção óbvia antes de ler o texto.
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = React.memo(
  ({
    isOpen,
    title,
    description,
    confirmLabel,
    cancelLabel,
    variant = "default",
    onClose,
    onConfirm,
    playSound,
  }) => {
    const visual = VARIANT_VISUALS[variant] ?? VARIANT_VISUALS.default;
    const { Icon, iconWrapClass, iconClass, confirmClass, defaultCancel } = visual;
    const resolvedCancel = cancelLabel ?? defaultCancel;

    // Re-dispara a animação do ícone a cada abertura do modal
    const [iconKey, setIconKey] = useState(0);
    useEffect(() => {
      if (isOpen) setIconKey((k) => k + 1);
    }, [isOpen]);

    const handleCloseAction = () => {
      playSound("back");
      onClose();
    };

    const handleConfirmAction = () => {
      playSound("select");
      void onConfirm();
    };

    return (
      <ModalShell
        isOpen={isOpen}
        onClose={handleCloseAction}
        maxWidthClassName="max-w-[400px]"
        zIndexClassName="z-[170]"
        className="relative overflow-hidden rounded-[22px] border border-white/8 bg-[#0A0A0A] px-7 pb-7 pt-8 shadow-[0_28px_70px_rgba(0,0,0,0.75)]"
        ariaLabel={title}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

        <div className="flex flex-col items-center text-center">
          <motion.div
            key={iconKey}
            initial={{ opacity: 0, scale: 0.7, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0.35, duration: 0.45 }}
            className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${iconWrapClass}`}
          >
            <Icon
              key={iconKey}
              size={28}
              animate
              loop={false}
              className={iconClass}
            />
          </motion.div>

          <h3 className="text-[18px] font-semibold tracking-tight text-white">
            {title}
          </h3>
          <p className="mt-2 max-w-[320px] text-[13.5px] font-medium leading-relaxed text-white/55">
            {description}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCloseAction}
            onMouseEnter={() => playSound("hover")}
            className="h-11 cursor-pointer rounded-full border border-white/8 bg-[#161616] px-4 text-[11px] font-bold uppercase tracking-[0.06em] text-white transition-all hover:bg-[#1E1E1E] active:scale-[0.97]"
          >
            {resolvedCancel}
          </button>
          <button
            type="button"
            onClick={handleConfirmAction}
            onMouseEnter={() => playSound("hover")}
            className={`h-11 cursor-pointer rounded-full px-4 text-[11px] font-bold uppercase tracking-[0.06em] transition-all active:scale-[0.97] ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </ModalShell>
    );
  },
);

ConfirmationModal.displayName = "ConfirmationModal";
