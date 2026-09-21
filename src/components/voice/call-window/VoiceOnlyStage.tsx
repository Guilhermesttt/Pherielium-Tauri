import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MicOff, VolumeX, UserPlus, MonitorUp, Monitor, MoreHorizontal, X, Radio } from "lucide-react";
import type { CallFeed } from "../VoiceCallWindow";
import type { CallState } from "../../../types/domain";
import { OrbloomOrb, mapCallToOrbState } from "../OrbloomOrb";
import { VideoRenderer } from "./VideoRenderer";
import { useAdaptiveGrid } from "./useAdaptiveGrid";
import { gridSpring, tileEnter } from "./motionTokens";

interface VoiceOnlyStageProps {
  feeds: CallFeed[];
  onOpenInvite?: () => void;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  callState?: CallState;
  onRefocusStream?: () => void;
  isScreenActive?: boolean;
  onContextMenu?: (e: React.MouseEvent, feed: CallFeed) => void;
  screenFeeds?: CallFeed[];
  onFocusScreen?: (feedId: string) => void;
  /** id do feed cujo menu de contexto (3 pontos) está aberto no momento — usado para animar o morph do botão. */
  activeMenuFeedId?: string | null;
  onVideoElement?: (el: HTMLVideoElement | null) => void;
}

/**
 * Scales every visual sub-element of a participant card continuously from the
 * measured tile width, instead of snapping between fixed size buckets. This is
 * what makes the grid feel like Discord's: cards grow/shrink smoothly as people
 * join or leave, rather than jumping between a handful of breakpoints.
 */
function getScaledLayout(tileWidth: number) {
  const clampedWidth = Math.max(120, Math.min(340, tileWidth));
  const t = (clampedWidth - 120) / (340 - 120); // 0..1 progress across the size range

  const orbSize = Math.round(64 + t * 108); // 64 -> 172
  const avatarRatio = 0.34;
  const avatarSize = Math.round(orbSize * avatarRatio * 1.6);
  const nameSize = 11 + t * 4; // 11px -> 15px
  const showSubtitle = clampedWidth > 190;

  return { orbSize, avatarSize, nameSize, showSubtitle };
}

/** Number of orb tiles we're willing to render at full quality on screen at once
 * before we start trimming visual fidelity to keep the grid smooth. */
const HEAVY_GRID_THRESHOLD = 6;

export const VoiceOnlyStage: React.FC<VoiceOnlyStageProps> = ({
  feeds,
  onOpenInvite,
  localStream,
  remoteStream,
  callState,
  onRefocusStream,
  onContextMenu,
  screenFeeds = [],
  onFocusScreen,
  activeMenuFeedId,
  onVideoElement,
}) => {
  const peopleFeeds = feeds.filter((f) => !f.isScreen);
  const isAlone = peopleFeeds.length <= 1 && screenFeeds.length === 0;

  const findScreenFeedFor = (peerId?: string) =>
    peerId ? screenFeeds.find((s) => s.peerId === peerId) : undefined;

  const hasVideoContent = screenFeeds.length > 0 || peopleFeeds.some((f) => f.cameraStream);
  const tileCount = peopleFeeds.length + screenFeeds.length;
  const orbQuality: "low" | "balanced" | "high" =
    tileCount > HEAVY_GRID_THRESHOLD ? "low" : tileCount > 1 ? "balanced" : "high";

  const { containerRef, tileWidth, tileHeight } = useAdaptiveGrid({
    count: Math.max(tileCount, 1),
    aspectRatio: hasVideoContent ? 1.5 : 0.88,
    gap: hasVideoContent ? 14 : 18,
    minTileWidth: hasVideoContent ? 190 : 150,
    maxTileWidth: hasVideoContent ? 460 : 320,
    padding: 8,
  });

  if (isAlone) {
    const single = peopleFeeds[0];
    const isSpeaking = Boolean(single?.isSpeaking);

    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-6 select-none overflow-hidden">
        {/* Banner de Transmissão Desfocada */}
        {onRefocusStream && (
          <div className="absolute top-4 z-30">
            <button
              type="button"
              onClick={onRefocusStream}
              style={{ cornerShape: "squircle" } as React.CSSProperties}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold backdrop-blur-md shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <MonitorUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Transmissão ao vivo em andamento</span>
              <span className="text-white underline pl-1">Focar tela</span>
            </button>
          </div>
        )}

        <div
          role="button"
          tabIndex={0}
          aria-label={`Participante ${single?.title || "Você"}`}
          style={{ cornerShape: "squircle" } as React.CSSProperties}
          onContextMenu={(e) => single && onContextMenu?.(e, single)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && single) {
              e.preventDefault();
              onContextMenu?.(e as any, single);
            }
          }}
          className={`relative group flex flex-col items-center justify-center rounded-[28px] bg-[#0F0F0F]/80 backdrop-blur-md border transition-all duration-300 w-72 sm:w-80 h-[340px] sm:h-[380px] p-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40 overflow-hidden ${
            isSpeaking
              ? "border-emerald-400/60 shadow-[0_0_35px_rgba(52,211,153,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] -translate-y-1"
              : "border-[#161616] hover:border-white/20 hover:bg-[#141414]/90"
          }`}
        >
          {single?.cameraStream ? (
            <>
              <VideoRenderer
                stream={single.cameraStream}
                fitMode="cover"
                muted={single.isLocal}
                className="absolute inset-0"
                onVideoElement={onVideoElement}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="relative z-10 mt-auto space-y-1">
                <h3 className="text-base font-bold text-white tracking-tight truncate max-w-[220px] flex items-center justify-center gap-1.5">
                  {isSpeaking && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
                  {single?.title || "Você"}
                </h3>
                <p className="text-xs text-white/60 font-medium">Câmera ativa</p>
              </div>
            </>
          ) : (
            <>
              {/* Orbloom Orb de fundo + Avatar Central */}
              <div className="relative flex items-center justify-center h-44 w-44 sm:h-48 sm:w-48 mb-3">
                {single && (
                  <OrbloomOrb
                    size={168}
                    quality="high"
                    orbState={mapCallToOrbState({
                      isRinging: single.isRinging,
                      isConnecting: single.isConnecting,
                      isMuted: single.isMuted,
                      isDeafened: single.isDeafened,
                      isSpeaking,
                      callActive: callState === "active" || (!single.isRinging && !single.isConnecting),
                    })}
                    audioStream={single.isLocal ? localStream : (single.stream || remoteStream)}
                    participantId={single.peerId || single.id || single.title}
                    color={single.color}
                    ambientMotion={false}
                    isLocal={single.isLocal}
                    label={`Atividade de voz de ${single.title}`}
                  />
                )}

                <div
                  className={`absolute h-20 w-20 sm:h-22 sm:w-22 rounded-full overflow-hidden border-2 transition-all duration-200 z-10 ${
                    isSpeaking
                      ? "border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.35)] scale-105"
                      : "border-white/15"
                  }`}
                >
                  {single?.avatar ? (
                    <img
                      src={single.avatar}
                      alt={single.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/70 font-black text-white text-2xl backdrop-blur-sm">
                      {single?.title?.slice(0, 2).toUpperCase() || "VC"}
                    </div>
                  )}
                </div>

                {single?.isMuted && (
                  <div
                    title="Microfone desativado"
                    className="absolute bottom-2 right-2 p-2 rounded-full bg-rose-600 text-white shadow-lg ring-2 ring-[#0F0F0F] z-20"
                  >
                    <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="space-y-1 mb-4">
                <h3 className="text-base font-bold text-white tracking-tight truncate max-w-[220px]">
                  {single?.title || "Você"}
                </h3>
                <p className="text-xs text-white/60 font-medium">
                  Você é o único na chamada no momento
                </p>
              </div>

              {onOpenInvite && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenInvite();
                  }}
                  style={{ cornerShape: "squircle" } as React.CSSProperties}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[14px] bg-white/[0.06] hover:bg-white/[0.12] text-white border border-[#161616] text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Convidar Amigos</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const layout = getScaledLayout(tileWidth);

  // 2 a N participantes: Grade dinâmica que recalcula colunas/tamanho continuamente,
  // igual ao comportamento do Discord ao entrar/sair gente da chamada. Cada
  // participante tem UM único card — se a câmera estiver ativa, o vídeo aparece
  // dentro do próprio card da pessoa; sem câmera, mostra o orbe. A tela
  // compartilhada ganha o seu próprio card dedicado dentro da mesma grade.
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 select-none overflow-hidden"
    >
      <motion.div
        layout
        transition={gridSpring}
        className="flex flex-wrap items-center justify-center"
        style={{ gap: hasVideoContent ? 14 : 18, maxWidth: "100%" }}
      >
        <AnimatePresence mode="popLayout">
          {screenFeeds.map((screenFeed) => (
            <motion.div
              key={screenFeed.id}
              layout
              initial={tileEnter.initial}
              animate={tileEnter.animate}
              exit={tileEnter.exit}
              transition={tileEnter.transition}
              role="button"
              tabIndex={0}
              aria-label={`Transmissão de tela de ${screenFeed.title}`}
              onClick={() => onFocusScreen?.(screenFeed.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onFocusScreen?.(screenFeed.id);
                }
              }}
              style={{
                cornerShape: "squircle",
                width: tileWidth,
                height: tileHeight,
              } as React.CSSProperties}
              className="group relative flex items-center justify-center rounded-[24px] overflow-hidden bg-[#060606] border border-sky-400/50 shadow-[0_0_30px_rgba(56,189,248,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              {screenFeed.stream ? (
                <VideoRenderer stream={screenFeed.stream} fitMode="cover" muted className="h-full w-full opacity-90" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#0A0A0A]">
                  <Monitor className="h-10 w-10 text-white/20" />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/40 pointer-events-none" />

              {/* Badge "AO VIVO" */}
              <div
                style={{ cornerShape: "squircle" } as React.CSSProperties}
                className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-[9px] bg-rose-500/90 text-white text-[10px] font-bold z-10 shadow-md"
              >
                <Radio className="h-2.5 w-2.5 animate-pulse" aria-hidden="true" />
                <span>AO VIVO</span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusScreen?.(screenFeed.id);
                }}
                style={{ cornerShape: "squircle" } as React.CSSProperties}
                className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-[9px] bg-black/55 hover:bg-sky-500/80 text-sky-200 hover:text-white text-[10px] font-semibold z-10 backdrop-blur-md cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
              >
                <span>Focar tela</span>
              </button>

              {/* Nome de quem está transmitindo */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-2 z-10">
                <div
                  style={{ cornerShape: "squircle" } as React.CSSProperties}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-black/50 border border-sky-400/30 backdrop-blur-md text-sky-300 text-xs font-semibold tracking-tight truncate"
                >
                  <Monitor className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{screenFeed.title} está transmitindo</span>
                </div>
              </div>
            </motion.div>
          ))}

          {peopleFeeds.map((feed) => {
            const isSpeaking = Boolean(feed.isSpeaking);
            const presentingScreen = findScreenFeedFor(feed.peerId);
            const isPresenting = Boolean(presentingScreen);
            const hasCamera = Boolean(feed.cameraStream);

            return (
              <motion.div
                key={feed.id}
                layout
                initial={tileEnter.initial}
                animate={tileEnter.animate}
                exit={tileEnter.exit}
                transition={tileEnter.transition}
                role="button"
                tabIndex={0}
                aria-label={`Participante ${feed.title}${feed.isLocal ? " (Você)" : ""}`}
                style={{
                  cornerShape: "squircle",
                  width: tileWidth,
                  height: tileHeight,
                } as React.CSSProperties}
                onClick={() => {
                  if (isPresenting && presentingScreen && onFocusScreen) {
                    onFocusScreen(presentingScreen.id);
                  }
                }}
                onContextMenu={(e) => onContextMenu?.(e, feed)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onContextMenu?.(e as any, feed);
                  }
                }}
                className={`group relative flex flex-col items-center justify-center rounded-[24px] bg-[#0F0F0F]/80 backdrop-blur-md border transition-colors duration-300 text-center shadow-[0_10px_30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus-visible:ring-2 focus-visible:ring-white/40 overflow-hidden ${
                  isPresenting
                    ? "border-sky-400/60 shadow-[0_0_30px_rgba(56,189,248,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] cursor-pointer"
                    : isSpeaking
                      ? "border-emerald-400/60 shadow-[0_0_30px_rgba(52,211,153,0.22),inset_0_1px_0_rgba(255,255,255,0.1)]"
                      : "border-[#161616] hover:border-white/20 hover:bg-[#141414]/90 cursor-default"
                }`}
              >
                {/* Botão de 3 pontos — morph plus-to-menu (transitions.dev): o ícone
                    gira e a superfície "acorda" com uma leve escala assim que o
                    menu associado abre, em vez de só aparecer/desaparecer. */}
                <button
                  type="button"
                  aria-label={`Opções e volume de ${feed.title}`}
                  aria-expanded={activeMenuFeedId === feed.id}
                  data-open={activeMenuFeedId === feed.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onContextMenu?.(e, feed);
                  }}
                  className={`absolute top-2 right-2 p-1.5 rounded-full border text-white/60 hover:text-white z-30 cursor-pointer shadow-sm transition-[background-color,border-color,transform] duration-200 ${
                    activeMenuFeedId === feed.id
                      ? "opacity-100 bg-white/20 border-white/25 scale-105"
                      : "opacity-0 group-hover:opacity-100 bg-white/[0.06] hover:bg-white/[0.14] border-[#161616]"
                  }`}
                  style={{ transitionTimingFunction: "cubic-bezier(0.34,1.25,0.64,1)" }}
                  title="Ajustar volume / Opções"
                >
                  <motion.span
                    animate={{ rotate: activeMenuFeedId === feed.id ? 90 : 0 }}
                    transition={{ duration: 0.25, ease: [0.34, 1.25, 0.64, 1] }}
                    className="flex items-center justify-center"
                  >
                    {activeMenuFeedId === feed.id ? (
                      <X className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <MoreHorizontal className="h-3 w-3" aria-hidden="true" />
                    )}
                  </motion.span>
                </button>

                {/* Badge de transmissão de tela ativa (padrão Discord: destaque + nome) */}
                {isPresenting && (
                  <div
                    style={{ cornerShape: "squircle" } as React.CSSProperties}
                    className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-[10px] bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[10px] font-bold z-30 backdrop-blur-md"
                    title={`${feed.title} está compartilhando a tela — clique para focar`}
                  >
                    <Monitor className="h-2.5 w-2.5" aria-hidden="true" />
                    <span>Transmitindo</span>
                  </div>
                )}

                {hasCamera ? (
                  <>
                    <VideoRenderer
                      stream={feed.cameraStream!}
                      fitMode="cover"
                      muted={feed.isLocal}
                      className="absolute inset-0"
                      onVideoElement={peopleFeeds.length === 1 ? onVideoElement : undefined}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                    <div className="relative z-10 mt-auto flex items-center gap-1.5 max-w-full justify-center px-2 pb-2">
                      {isSpeaking && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" aria-label="Falando" />
                      )}
                      <span
                        className={`tracking-tight truncate font-semibold drop-shadow-md ${
                          isPresenting ? "text-sky-300" : "text-white"
                        }`}
                        style={{ fontSize: layout.nameSize, maxWidth: tileWidth - 32 }}
                      >
                        {feed.title}
                      </span>
                      {feed.isDeafened ? (
                        <VolumeX className="h-3 w-3 text-rose-400 shrink-0" aria-hidden="true" />
                      ) : feed.isMuted ? (
                        <MicOff className="h-3 w-3 text-rose-400 shrink-0" aria-hidden="true" />
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Orbloom Orb de fundo + Avatar central */}
                    <div
                      className="relative flex items-center justify-center mb-1.5"
                      style={{ height: layout.orbSize, width: layout.orbSize }}
                    >
                      <OrbloomOrb
                        size={layout.orbSize}
                        quality={orbQuality}
                        orbState={mapCallToOrbState({
                          isRinging: feed.isRinging,
                          isConnecting: feed.isConnecting,
                          isMuted: feed.isMuted,
                          isDeafened: feed.isDeafened,
                          isSpeaking,
                          callActive: callState === "active" || (!feed.isRinging && !feed.isConnecting),
                        })}
                        audioStream={feed.isLocal ? localStream : (feed.stream || remoteStream)}
                        participantId={feed.peerId || feed.id || feed.title}
                        color={feed.color}
                        ambientMotion={false}
                        isLocal={feed.isLocal}
                        label={`Atividade de voz de ${feed.title}`}
                      />

                      <div
                        className={`absolute rounded-full overflow-hidden border-2 transition-all duration-200 z-10 ${
                          isSpeaking
                            ? "border-white/80 shadow-[0_0_16px_rgba(255,255,255,0.35)] scale-105"
                            : "border-white/15"
                        }`}
                        style={{ height: layout.avatarSize, width: layout.avatarSize }}
                      >
                        {feed.avatar ? (
                          <img
                            src={feed.avatar}
                            alt={feed.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-black/70 font-black text-white backdrop-blur-sm">
                            {feed.title.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {feed.isDeafened ? (
                        <div
                          title="Áudio silenciado (Deafened)"
                          className="absolute bottom-1 right-1 p-1.5 rounded-full bg-rose-600 text-white shadow-md ring-2 ring-[#0F0F0F] z-20"
                        >
                          <VolumeX className="h-3 w-3" aria-hidden="true" />
                        </div>
                      ) : feed.isMuted ? (
                        <div
                          title="Microfone mutado"
                          className="absolute bottom-1 right-1 p-1.5 rounded-full bg-rose-600 text-white shadow-md ring-2 ring-[#0F0F0F] z-20"
                        >
                          <MicOff className="h-3 w-3" aria-hidden="true" />
                        </div>
                      ) : null}
                    </div>

                    {/* Nome do Participante */}
                    <div className="flex items-center gap-1.5 max-w-full justify-center px-2">
                      <span
                        className={`tracking-tight truncate font-semibold ${
                          isPresenting ? "text-sky-300" : "text-white"
                        }`}
                        style={{ fontSize: layout.nameSize, maxWidth: tileWidth - 32 }}
                      >
                        {feed.title}
                      </span>
                      {isSpeaking && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" aria-label="Falando" />
                      )}
                    </div>

                    {layout.showSubtitle && (
                      <span className="text-[11px] text-white/60 mt-0.5 font-medium">
                        {isPresenting
                          ? "Transmitindo tela"
                          : feed.isLocal
                            ? "Você"
                            : isSpeaking
                              ? "Falando…"
                              : feed.isMuted
                                ? "Mutado"
                                : "Conectado"}
                      </span>
                    )}
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
