import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldAlert,
} from "lucide-react";
import type { RoomCategory } from "../../types/voice-governance";
import { modalBackdropMotion, modalMotion } from "../../design-system/motion";
import { IconSwap } from "../ui/IconSwap";
import { useModalSounds } from "../../hooks/useModalSounds";

interface CallPrivacyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isPrivate: boolean;
  currentPassword?: string;
  currentCategory?: RoomCategory;
  onSavePrivacy: (isPrivate: boolean, password?: string) => Promise<void> | void;
}

export const CallPrivacyPanel: React.FC<CallPrivacyPanelProps> = ({
  isOpen,
  onClose,
  isPrivate: initialIsPrivate,
  currentPassword = "",
  onSavePrivacy,
}) => {
  useModalSounds(isOpen);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [password, setPassword] = useState(currentPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (isPrivate && !password.trim()) {
      setError("Defina uma senha para a sala privada.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSavePrivacy(isPrivate, isPrivate ? password.trim() : undefined);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div {...modalBackdropMotion} className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl select-none">
        {/* Backdrop click dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          {...modalMotion}
          className="glass-panel relative flex flex-col w-full max-w-sm rounded-3xl border border-transparent shadow-[0_30px_90px_rgba(0,0,0,0.95)] z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-transparent bg-black/30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tone-3)] text-[var(--ink)] border border-transparent shadow-sm">
                <IconSwap active={isPrivate} a={<Unlock className="h-5 w-5 text-[var(--ink)]" />} b={<Lock className="h-5 w-5 text-[var(--ink)]" />} />
              </div>
              <div>
                <h3 className="text-sm font-black text-[var(--ink)] tracking-tight uppercase">
                  Privacidade da Chamada
                </h3>
                <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">Controle de acesso e senha</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-xl bg-[var(--tone-3)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)] transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Controls */}
          <div className="p-6 space-y-5">
            {/* Public vs Private Toggle Switch */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--tone-3)] border border-transparent">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                  <IconSwap active={isPrivate} a={<Unlock className="h-3.5 w-3.5 text-[var(--live)]" />} b={<Lock className="h-3.5 w-3.5 text-[var(--ink)]" />} />
                  <span>{isPrivate ? "Sala Privada" : "Sala Aberta"}</span>
                </span>
                <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">
                  {isPrivate ? "Apenas convidados com a senha podem entrar" : "Qualquer amigo convidado entra direto"}
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => {
                  setIsPrivate((prev) => !prev);
                  setError(null);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPrivate ? "bg-[var(--tone-3)]" : "bg-[var(--tone-4)]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[var(--ink)] shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isPrivate ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Password Input (Active when Private) */}
            {isPrivate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <label className="text-[length:var(--step-0)] font-bold text-[var(--ink-muted)] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-[var(--ink)]" />
                    <span>Senha de Acesso</span>
                  </span>
                </label>

                <div className="relative flex items-center">
                  <input aria-label="Senha da sala"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite uma senha para a sala..."
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="w-full h-10 px-3.5 pr-10 rounded-xl bg-[var(--tone-3)] border border-transparent text-xs font-semibold text-[var(--ink)] placeholder-white/30 focus:outline-none focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 text-[var(--ink-faint)] hover:text-[var(--ink)] transition"
                    title={showPassword ? "Ocultar senha" : "Ver senha"}
                  >
                    <IconSwap active={showPassword} a={<Eye className="h-4 w-4" />} b={<EyeOff className="h-4 w-4" />} />
                  </button>
                </div>
              </motion.div>
            )}

            {error && (
              <p className="text-[length:var(--step-0)] text-[var(--danger)] font-medium flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-transparent bg-black/20 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[var(--tone-3)] hover:bg-[var(--tone-4)] border border-transparent text-[var(--ink)] font-bold text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-[var(--tone-0)] hover:opacity-90 font-black text-xs shadow-md transition hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSaving ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Salvar</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
    </AnimatePresence>
  );
};
