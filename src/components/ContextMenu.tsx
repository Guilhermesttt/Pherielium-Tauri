import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Edit3, Star } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";

interface ContextMenuProps {
  children: React.ReactNode;
  gameTitle: string;
  onAction: (action: string) => void;
  isFavorite?: boolean;
  playSound: (type: any) => void;
}

const MENU_WIDTH = 224;

const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  gameTitle,
  onAction,
  isFavorite,
  playSound,
}) => {
  const { t } = usePreferences();
  const [isOpen, setIsOpen] = useState(false);
  // Abre para o lado (no vão entre um card e outro) em vez de sobrepor a arte
  // do jogo — o card fica sempre visível e o título no topo do menu deixa
  // claro para qual jogo aquelas opções se aplicam.
  const [side, setSide] = useState<"right" | "left">("right");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) {
      const fitsOnRight = rect.right + MENU_WIDTH + 16 <= window.innerWidth;
      setSide(fitsOnRight ? "right" : "left");
    }
    playSound?.("select");
    setIsOpen(true);
  }, [playSound]);

  return (
    <div
      ref={wrapperRef}
      className="relative shrink-0"
      onContextMenu={handleOpen}
    >
      {children}

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop invisível para fechar ao clicar fora */}
            <div
              className="fixed inset-0 z-[280]"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
              }}
            />

            {/* Menu ancorado no vão lateral do card — nunca cobre a arte do jogo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, x: side === "right" ? -8 : 8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.94, x: side === "right" ? -8 : 8 }}
              transition={{ type: "spring", bounce: 0, duration: 0.28 }}
              style={{
                width: MENU_WIDTH,
                top: "50%",
                y: "-50%",
                ...(side === "right" ? { left: "calc(100% + 10px)" } : { right: "calc(100% + 10px)" }),
              }}
              className="absolute z-[300] rounded-2xl p-2 flex flex-col gap-1 shadow-[0_24px_48px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] glass-panel"
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {/* Título do jogo no topo — identifica claramente a qual card o menu pertence */}
              <div className="px-3 pt-1.5 pb-2 mb-0.5 border-b border-white/10">
                <p className="text-[11px] font-bold text-white truncate" title={gameTitle}>
                  {gameTitle}
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  playSound?.("edit");
                  setIsOpen(false);
                  onAction("edit");
                }}
                onMouseEnter={() => playSound?.("hover")}
                className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[11.5px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10 hover:text-white cursor-pointer transition-colors text-left outline-none"
              >
                <Edit3 className="w-4 h-4 text-white/70" />
                <span>{t("editMetadata")}</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  playSound?.(isFavorite ? "favoriteOff" : "favoriteOn");
                  setIsOpen(false);
                  onAction("favorite");
                }}
                onMouseEnter={() => playSound?.("hover")}
                className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[11.5px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10 hover:text-white cursor-pointer transition-colors text-left outline-none"
              >
                <Star
                  className={`w-4 h-4 ${
                    isFavorite ? "text-amber-300 fill-amber-300" : "text-white/70"
                  }`}
                />
                <span>{isFavorite ? t("removeFavorite") : t("addFavorite")}</span>
              </motion.button>

              <div className="bg-white/10 h-px my-0.5 mx-2" />

              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  playSound?.("delete");
                  setIsOpen(false);
                  onAction("delete");
                }}
                onMouseEnter={() => playSound?.("hover")}
                className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[11.5px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 hover:text-red-400 cursor-pointer transition-colors text-left outline-none"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>{t("removeFromLibrary")}</span>
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContextMenu;
