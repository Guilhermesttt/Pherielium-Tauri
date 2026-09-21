import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Minus, Square, Copy, X, Maximize2, Minimize2 } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import pherieliumDesktopIcon from "../../assets/Pherielium_Desktop_icon.png";

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
  const hoverTimeoutRef = useRef<number | null>(null);

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
        className={`select-none items-center justify-between font-sans text-xs tracking-tight text-white/70 ${
          isFullscreen
            ? "fixed top-0 left-0 right-0 z-50 flex h-9 px-3 border-b border-white/[0.08] bg-[#070707]/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)]"
            : "relative z-50 flex h-9 w-full shrink-0 px-3 border-b border-white/[0.04] bg-[#070707] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
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
              className="h-5 w-5 object-contain select-none pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
              draggable={false}
            />
            <span className="font-semibold text-white/90 tracking-[-0.01em] text-[12px] select-none pointer-events-none">
              Pherielium
            </span>
          </div>

          {/* Divisor sutil */}
          <div className="h-3 w-[1px] bg-white/10 pointer-events-none select-none" />

          {/* Botão Tela Cheia ao lado do nome Pherielium */}
          <motion.button
            type="button"
            onClick={handleToggleFullscreen}
            whileHover={{ scale: 1.03, backgroundColor: "rgba(255, 255, 255, 0.12)" }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.2 }}
            className={`group flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium transition-colors cursor-pointer ${
              isFullscreen
                ? "bg-white/20 text-white shadow-inner"
                : "bg-white/[0.06] text-white/70 hover:text-white border border-white/[0.08]"
            }`}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            title={isFullscreen ? "Sair da tela cheia (F11 ou Esc)" : "Entrar em tela cheia (F11)"}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-2.5 w-2.5 text-white/90 transition-transform group-hover:scale-110" />
            ) : (
              <Maximize2 className="h-2.5 w-2.5 text-white/70 transition-transform group-hover:scale-110 group-hover:text-white" />
            )}
            <span>{isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}</span>
          </motion.button>
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
            whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
            whileTap={{ scale: 0.92, backgroundColor: "rgba(255, 255, 255, 0.14)" }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
            className="flex h-7 w-8 items-center justify-center rounded-[6px] text-white/60 transition-colors hover:text-white focus:outline-none cursor-pointer"
            title="Minimizar"
            aria-label="Minimizar janela"
          >
            <Minus className="h-3.5 w-3.5 stroke-[2]" />
          </motion.button>

          {/* Botão Maximizar / Restaurar */}
          <motion.button
            type="button"
            onClick={handleToggleMaximize}
            whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
            whileTap={{ scale: 0.92, backgroundColor: "rgba(255, 255, 255, 0.14)" }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
            className="flex h-7 w-8 items-center justify-center rounded-[6px] text-white/60 transition-colors hover:text-white focus:outline-none cursor-pointer"
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
            whileHover={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}
            whileTap={{ scale: 0.92, backgroundColor: "rgba(239, 68, 68, 0.35)" }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
            className="flex h-7 w-8 items-center justify-center rounded-[6px] text-white/60 transition-colors hover:text-red-400 focus:outline-none cursor-pointer"
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
