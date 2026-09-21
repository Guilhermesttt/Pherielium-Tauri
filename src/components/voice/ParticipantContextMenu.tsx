import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Volume2, VolumeX, Volume1, UserX, Tv, Check, MicOff, Mic } from 'lucide-react';
import type { CallFeed } from '../../types/voice-governance';

interface ParticipantContextMenuProps {
  feed: CallFeed;
  x: number;
  y: number;
  volume: number;
  isLocallyMuted?: boolean;
  isLocalAdmin?: boolean;
  onVolumeChange: (newVol: number) => void;
  onToggleLocalMute?: () => void;
  onKickParticipant?: (peerId: string) => void;
  onToggleWatchStream?: (feedId: string) => void;
  onClose: () => void;
}

/**
 * Anchored, viewport-safe context menu for a call participant.
 *
 * Rendered through a portal directly on `document.body` — the previous
 * implementation lived inside the call window's animated container, which
 * applies a persistent CSS `transform` (via framer-motion) on the root
 * surface. Per spec, a `transform` on an ancestor creates a new containing
 * block for `position: fixed` descendants, so the menu's viewport-based math
 * was actually being resolved against the (smaller, clipped) call window
 * box instead of the real screen — causing it to fly off and disappear
 * behind `overflow-hidden`. Portaling to <body> sidesteps that entirely, and
 * we measure the real rendered size instead of guessing a fixed height so
 * the clamped position always fits fully on screen.
 */
export const ParticipantContextMenu: React.FC<ParticipantContextMenuProps> = ({
  feed,
  x,
  y,
  volume,
  isLocallyMuted = false,
  isLocalAdmin = false,
  onVolumeChange,
  onToggleLocalMute,
  onKickParticipant,
  onToggleWatchStream,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setMeasured({ width: rect.width, height: rect.height });
    }
  }, [feed.id, isLocallyMuted, feed.isScreenLiveAvailable, isLocalAdmin]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleOutsideClick, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  const menuWidth = measured?.width ?? 240;
  const menuHeight = measured?.height ?? 220;
  const clampedX = Math.min(Math.max(10, x), window.innerWidth - menuWidth - 10);
  const clampedY = Math.min(Math.max(10, y), window.innerHeight - menuHeight - 10);

  return createPortal(
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', bounce: 0.15, duration: 0.22 }}
      style={{
        top: clampedY,
        left: clampedX,
        visibility: measured ? 'visible' : 'hidden',
        cornerShape: 'squircle',
      } as React.CSSProperties}
      className="fixed z-9999999 w-64 p-3 rounded-2xl border border-[#161616] bg-[#0F0F0F]/95 shadow-[0_24px_70px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl text-white space-y-2.5 select-none"
    >
      {/* Header Info */}
      <div className="px-2 py-1 border-b border-[#161616] flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <div className="h-2 w-2 rounded-full bg-white" />
          <span className="text-xs font-semibold truncate">{feed.title}</span>
        </div>
        <span className="text-[10px] font-mono tabular-nums text-white/80 bg-white/[0.06] border border-[#161616] px-1.5 py-0.5 rounded">
          {isLocallyMuted ? 'MUDO' : `${volume}%`}
        </span>
      </div>

      {/* Volume Control Slider (0 - 200%) */}
      {!feed.isLocal && (
        <div className="p-3 space-y-2 bg-white/[0.03] rounded-xl border border-[#161616]">
          <div className="flex items-center justify-between text-[11px] font-medium text-white/80">
            <span className="flex items-center gap-1.5">
              {isLocallyMuted || volume === 0 ? (
                <VolumeX className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
              ) : volume < 60 ? (
                <Volume1 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>Volume Individual</span>
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={200}
            value={isLocallyMuted ? 0 : volume}
            aria-label={`Volume de ${feed.title}`}
            onChange={(e) => {
              if (isLocallyMuted && onToggleLocalMute) {
                onToggleLocalMute();
              }
              onVolumeChange(Number(e.target.value));
            }}
            className="w-full accent-white cursor-pointer h-1.5 outline-none focus-visible:ring-1 focus-visible:ring-white/50"
          />

          <div className="flex justify-between text-[9px] font-semibold text-white/50">
            <span onClick={() => onVolumeChange(0)} className="cursor-pointer hover:text-white">
              0%
            </span>
            <span onClick={() => onVolumeChange(100)} className="cursor-pointer hover:text-white">
              100%
            </span>
            <span onClick={() => onVolumeChange(200)} className="cursor-pointer hover:text-white">
              200%
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-1">
        {/* Toggle Local Mute */}
        {!feed.isLocal && onToggleLocalMute && (
          <button
            type="button"
            onClick={() => {
              onToggleLocalMute();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium hover:bg-white/[0.08] transition cursor-pointer text-left outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          >
            <span className="flex items-center gap-2">
              {isLocallyMuted ? (
                <>
                  <Mic className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Desmutar para mim</span>
                </>
              ) : (
                <>
                  <MicOff className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                  <span>Mutar para mim</span>
                </>
              )}
            </span>
          </button>
        )}

        {/* Watch Stream Toggle (On-Demand) */}
        {feed.isScreenLiveAvailable && onToggleWatchStream && (
          <button
            type="button"
            onClick={() => {
              onToggleWatchStream(feed.id as string);
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium hover:bg-white/[0.08] transition cursor-pointer text-left outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          >
            <span className="flex items-center gap-2">
              <Tv className="h-3.5 w-3.5 text-white" aria-hidden="true" />
              <span>{feed.isCurrentlyWatched ? 'Parar de Assistir' : 'Assistir Transmissão'}</span>
            </span>
            {feed.isCurrentlyWatched && <Check className="h-3 w-3 text-white" aria-hidden="true" />}
          </button>
        )}

        {/* Admin Kick Action */}
        {isLocalAdmin && !feed.isLocal && onKickParticipant && (
          <div className="pt-1 border-t border-[#161616]">
            <button
              type="button"
              onClick={() => {
                onKickParticipant(feed.peerId || (feed.id as string));
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition cursor-pointer text-left outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
            >
              <UserX className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Expulsar da Chamada</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>,
    document.body
  );
};
