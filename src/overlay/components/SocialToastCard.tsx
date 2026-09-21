import React from "react";
import { motion } from "framer-motion";
import { Check, PhoneCall, PhoneOff, X } from "lucide-react";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";
import type { SocialToast } from "../OverlayApp";

export interface SocialToastActions {
  onAcceptCall?: () => void;
  onRejectCall?: () => void;
  onAcceptFriend?: () => void;
  onDeclineFriend?: () => void;
  onDismiss?: () => void;
}

interface SocialToastCardProps extends SocialToastActions {
  toast: SocialToast;
  accentColor?: string;
  animated?: boolean;
}

function contextLabel(kind: string, contentKind?: string): string {
  switch (kind) {
    case "incoming-call":
    case "call":
      return "CHAMADA DE VOZ";
    case "message":
    case "friend-message":
      return contentKind === "image" ? "NOVA IMAGEM" : "NOVA MENSAGEM";
    case "friend-request":
      return "PEDIDO DE AMIZADE";
    case "friend-accepted":
      return "PEDIDO ACEITO";
    case "friend-playing":
      return "AMIGO JOGANDO";
    case "capture":
    case "capture-saved":
      return "CAPTURA SALVA";
    case "level-up":
      return "SUBIU DE NÍVEL";
    case "success":
      return "SUCESSO";
    case "error":
      return "ERRO";
    case "info":
      return "INFORMAÇÃO";
    default:
      return "PHELIERIUM";
  }
}

function contextDescription(toast: SocialToast): string | undefined {
  const raw = toast.message || toast.description || toast.subtitle;
  switch (toast.kind) {
    case "incoming-call":
    case "call":
      return raw || `${toast.senderName || toast.title} está te ligando.`;
    case "friend-request":
      return raw || "Quer se conectar com você no Phelierium.";
    case "friend-accepted":
      return raw || "Aceitou seu pedido de amizade.";
    case "friend-playing":
      return toast.gameTitle ? `Jogando ${toast.gameTitle}` : raw;
    case "message":
    case "friend-message":
      return toast.contentKind === "image" ? "Enviou uma imagem." : raw;
    default:
      return raw;
  }
}

export const SocialToastCard: React.FC<SocialToastCardProps> = ({
  toast,
  accentColor = "#ffffff",
  animated = true,
  onAcceptCall,
  onRejectCall,
  onAcceptFriend,
  onDeclineFriend,
  onDismiss,
}) => {
  const isCall = toast.kind === "incoming-call" || toast.kind === "call";
  const isMessage = toast.kind === "message" || toast.kind === "friend-message";
  const isFriendRequest = toast.kind === "friend-request";
  const senderName = toast.senderName || toast.title || "Phelierium";
  const description = contextDescription(toast);
  const hasPhoto = Boolean(toast.avatar);
  const hasActions = isCall || isMessage || isFriendRequest;

  const spring = animated
    ? { type: "spring" as const, stiffness: 340, damping: 26, mass: 0.7 }
    : { duration: 0.2 };

  return (
    <motion.div
      initial={{ opacity: 0, x: -28, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -22, scale: 0.96, transition: { duration: 0.22 } }}
      transition={spring}
      whileHover={animated ? { scale: 1.015, y: -2 } : undefined}
      className={`overlay-card social-card${hasActions ? " has-actions" : ""}${isCall ? " is-ringing" : ""}`}
      style={isCall ? ({ ["--card-duration" as string]: "30000ms" } as React.CSSProperties) : undefined}
    >
      <div className="overlay-shell layout-left">
        <motion.div
          className="overlay-icon"
          aria-hidden
          initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={animated ? { type: "spring", stiffness: 460, damping: 18, delay: 0.05 } : { duration: 0.2 }}
        >
          {animated ? <span className="icon-halo" /> : null}
          <div className={`icon-avatar${hasPhoto ? " is-photo" : " is-logo"}`}>
            <img src={toast.avatar || PHERIELIUM_LOGO_PATH} alt="" className="icon-image" />
          </div>
        </motion.div>

        <div className="overlay-content">
          <div className="overlay-text">
            <motion.div
              className="social-badge"
              initial={{ opacity: 0, y: -8, scale: 0.86 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.34, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              {contextLabel(toast.kind, toast.contentKind)}
            </motion.div>
            <motion.h2
              className="social-title"
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.4, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {senderName}
            </motion.h2>
            {description ? (
              <motion.p
                className="social-description"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {description}
              </motion.p>
            ) : null}
          </div>

          {hasActions ? (
            <motion.div
              className="overlay-actions"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {isCall ? (
                <>
                  <button
                    type="button"
                    onClick={onAcceptCall}
                    className="overlay-action is-accept"
                    style={{ backgroundColor: accentColor }}
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    Atender
                  </button>
                  <button type="button" onClick={onRejectCall} className="overlay-action is-danger">
                    <PhoneOff className="h-3.5 w-3.5" />
                    Desligar
                  </button>
                </>
              ) : null}

              {isMessage ? (
                <button type="button" onClick={onDismiss} className="overlay-action is-ghost">
                  <X className="h-3.5 w-3.5" />
                  Fechar
                </button>
              ) : null}

              {isFriendRequest ? (
                <>
                  <button
                    type="button"
                    onClick={onAcceptFriend}
                    className="overlay-action is-accept"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Aceitar
                  </button>
                  <button type="button" onClick={onDeclineFriend} className="overlay-action is-danger">
                    Recusar
                  </button>
                  <button type="button" onClick={onDismiss} className="overlay-action is-ghost">
                    Fechar
                  </button>
                </>
              ) : null}
            </motion.div>
          ) : null}
        </div>

        <div className="overlay-progress" aria-hidden />
      </div>
    </motion.div>
  );
};
