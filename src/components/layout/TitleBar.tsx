import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Minus, Square, Copy, X, Maximize2, Minimize2, ChevronLeft, ChevronRight } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import pherieliumDesktopIcon from "../../assets/Pherielium_Desktop_icon.png";
import {
  NAV_HISTORY_REQUEST_EVENT,
  NAV_HISTORY_STATE_EVENT,
  type NavHistoryFlags,
} from "../../services/navigationHistory";

interface TitleBarProps {
  isFullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  isFullscreen: externalIsFullscreen,
  onFullscreenChange,
}) => {
  const [internalIsFullscreen, setInternalIsFullscreen] = useState(false);
  const isFullscreen =
    externalIsFullscreen !== undefined ? externalIsFullscreen : internalIsFullscreen;

  const [isMaximized, setIsMaximized] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [navFlags, setNavFlags] = useState<NavHistoryFlags>({ canBack: false, canForward: false });
  const hoverTimeoutRef = useRef<number | null>(null);

  // O Home publica se há para onde voltar/avançar; a barra só mostra o estado e pede o passo.
  useEffect(() => {
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<NavHistoryFlags>).detail;
      if (detail) setNavFlags({ canBack: Boolean(detail.canBack), canForward: Boolean(detail.canForward) });
    };
    window.addEventListener(NAV_HISTORY_STATE_EVENT, onState);
    return () => window.removeEventListener(NAV_HISTORY_STATE_EVENT, onState);
  }, []);

  const requestHistoryStep = useCallback((direction: -1 | 1) => {
    window.dispatchEvent(new CustomEvent(NAV_HISTORY_REQUEST_EVENT, { detail: { direction } }));
  }, []);

  const updateFullscreenState = useCallback(
    (fs: boolean) => {
      setInternalIsFullscreen(fs);
      onFullscreenChange?.(fs);
    },
    [onFullscreenChange],
  );

  // Consulta estado inicial
  useEffect(() => {
    let mounted = true;
    window.electronAPI?.isMaximized?.().then((max) => {
      if (mounted && typeof max === "boolean") setIsMaximized(max);
    }).catch(() => {});

    window.electronAPI?.isFullScreen?.().then((fs) => {
      if (mounted && typeof fs === "boolean") updateFullscreenState(fs);
    }).catch(() => {});

    const handleResize = () => {
      window.electronAPI?.isMaximized?.().then((max) => {
        if (mounted && typeof max === "boolean") setIsMaximized(max);
      }).catch(() => {});

      window.electronAPI?.isFullScreen?.().then((fs) => {
        if (mounted && typeof fs === "boolean") updateFullscreenState(fs);
      }).catch(() => {});
    };

    window.addEventListener("resize", handleResize);
    return () => {
      mounted = false;
      window.removeEventListener("resize", handleResize);
    };
  }, [updateFullscreenState]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      const next = await window.electronAPI?.toggleFullScreen?.();
      if (typeof next === "boolean") {
        updateFullscreenState(next);
        if (!next) {
          setIsHovered(false);
        }
      }
    } catch (e) {
      console.error("Erro ao alternar tela cheia:", e);
    }
  }, [updateFullscreenState]);

  // Atalhos de teclado: F11 e Escape para alternar tela cheia
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.key === "Escape" && isFullscreen) {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, handleToggleFullscreen]);

  // Altura que a title bar ocupa no fluxo: 36px em janela, 0 em tela cheia
  // (la ela e `fixed` e fica escondida). O header usa isso junto com --notch-h
  // para nunca ficar embaixo do notch.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--titlebar-h", isFullscreen ? "0px" : "36px");
    return () => {
      root.style.removeProperty("--titlebar-h");
    };
  }, [isFullscreen]);

  const handleMinimize = useCallback(() => {
    window.electronAPI?.minimizeWindow?.();
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    if (isFullscreen) {
      // Em tela cheia, duplo clique restaura para modo janela
      await handleToggleFullscreen();
      return;
    }
    const isMax = await window.electronAPI?.maximizeWindow?.();
    if (typeof isMax === "boolean") {
      setIsMaximized(isMax);
    }
  }, [isFullscreen, handleToggleFullscreen]);

  const handleClose = useCallback(() => {
    window.electronAPI?.closeWindow?.();
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isFullscreen) return; // Não arrastar em modo tela cheia
      if (e.button === 0 && (e.target as HTMLElement).closest("button") === null) {
        if (e.detail === 1) {
          try {
            getCurrentWindow().startDragging();
          } catch {
            // Fallback
          }
        }
      }
    },
    [isFullscreen],
  );

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
    }, 260);
  }, []);

  return (
    <>
      {/* Sensor invisível no topo para revelar a titlebar em tela cheia ao aproximar o mouse */}
      {isFullscreen && (
        <div
          className="fixed top-0 left-0 right-0 h-2.5 z-[60] pointer-events-auto"
          onMouseEnter={handleMouseEnter}
        />
      )}

      <motion.header
        data-tauri-drag-region={!isFullscreen}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleToggleMaximize}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={false}
        animate={{
          y: isFullscreen ? (isHovered ? 0 : -42) : 0,
        }}
        transition={{
          type: "spring",
          bounce: 0,
          duration: 0.32,
        }}
        className={`select-none items-center justify-between font-sans text-xs tracking-tight text-[var(--ink-muted)] ${
          isFullscreen
            ? "fixed top-0 left-0 right-0 z-50 flex h-9 px-3 bg-[var(--chrome-black)]"
            : "relative z-50 flex h-9 w-full shrink-0 px-3 bg-[var(--chrome-black)]"
        }`}
        style={{
          WebkitAppRegion: isFullscreen ? "no-drag" : "drag",
        } as React.CSSProperties}
      >
        {/* Lado esquerdo: Logo + Título + Botão Tela Cheia */}
        <div className="flex items-center gap-2.5">
          <div
            data-tauri-drag-region={!isFullscreen}
            className="flex items-center gap-2 select-none py-0.5"
          >
            <img
              src={pherieliumDesktopIcon}
              alt="Pherielium"
              className="h-5 w-5 object-contain select-none pointer-events-none"
              draggable={false}
            />
            <span className="font-semibold text-[var(--ink)] tracking-[-0.01em] text-[length:var(--step-0)] select-none pointer-events-none">
              Pherielium
            </span>
          </div>

          {/* Botão Tela Cheia ao lado do nome Pherielium */}
          <motion.button
            type="button"
            onClick={handleToggleFullscreen}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.2 }}
            className={`group flex h-6 items-center gap-1.5 rounded-[var(--node)] px-3 text-[length:var(--step-0)] font-medium transition-colors cursor-pointer ${
              isFullscreen
                ? "bg-[var(--tone-4)] text-[var(--ink)]"
                : "bg-[var(--tone-2)] text-[var(--ink-muted)] hover:bg-[var(--tone-3)] hover:text-[var(--ink)]"
            }`}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            title={isFullscreen ? "Sair da tela cheia (F11 ou Esc)" : "Entrar em tela cheia (F11)"}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-2.5 w-2.5 text-[var(--ink)] transition-transform group-hover:scale-110" />
            ) : (
              <Maximize2 className="h-2.5 w-2.5 text-[var(--ink-muted)] transition-transform group-hover:scale-110 group-hover:text-[var(--ink)]" />
            )}
            <span>{isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}</span>
          </motion.button>

          {/* Voltar / avançar entre as seções do hub */}
          <div
            className="flex items-center gap-0.5"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {([
              { direction: -1 as const, enabled: navFlags.canBack, label: "Voltar", Icon: ChevronLeft },
              { direction: 1 as const, enabled: navFlags.canForward, label: "Avançar", Icon: ChevronRight },
            ]).map(({ direction, enabled, label, Icon }) => (
              <button
                key={label}
                type="button"
                disabled={!enabled}
                onClick={() => requestHistoryStep(direction)}
                aria-label={label}
                title={label}
                className="flex h-6 w-7 items-center justify-center rounded-[var(--node)] text-[var(--ink-muted)] transition-colors cursor-pointer hover:bg-[var(--tone-2)] hover:text-[var(--ink)] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Centro: Espaço amplo arrastável */}
        <div data-tauri-drag-region={!isFullscreen} className="flex-1 h-full" />

        {/* Lado direito: Controles da Janela (não-arrastáveis) */}
        <div
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="flex items-center gap-1 -mr-1"
        >
          {/* Botão Minimizar */}
          <motion.button
            type="button"
            onClick={handleMinimize}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
            className="flex h-7 w-9 items-center justify-center rounded-[var(--node)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--tone-3)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] cursor-pointer"
            title="Minimizar"
            aria-label="Minimizar janela"
          >
            <Minus className="h-3.5 w-3.5 stroke-[2]" />
          </motion.button>

          {/* Botão Maximizar / Restaurar */}
          <motion.button
            type="button"
            onClick={handleToggleMaximize}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
            className="flex h-7 w-9 items-center justify-center rounded-[var(--node)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--tone-3)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] cursor-pointer"
            title={isMaximized ? "Restaurar" : "Maximizar"}
            aria-label={isMaximized ? "Restaurar janela" : "Maximizar janela"}
          >
            {isMaximized ? (
              <Copy className="h-3 w-3 stroke-[2] -rotate-90" />
            ) : (
              <Square className="h-3 w-3 stroke-[2]" />
            )}
          </motion.button>

          {/* Botão Fechar */}
          <motion.button
            type="button"
            onClick={handleClose}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
            className="flex h-7 w-9 items-center justify-center rounded-[var(--node)] text-[var(--ink-muted)] transition-colors hover:bg-[#c42b1c] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] cursor-pointer"
            title="Fechar"
            aria-label="Fechar janela"
          >
            <X className="h-3.5 w-3.5 stroke-[2]" />
          </motion.button>
        </div>
      </motion.header>
    </>
  );
};

export default TitleBar;
