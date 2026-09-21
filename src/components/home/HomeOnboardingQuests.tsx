import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  Users,
  Gamepad2,
  Link,
  Star,
  Play,
  Trophy,
  ChevronDown,
  ChevronUp,
  X,
  Compass,
  ArrowRight,
  PartyPopper,
} from "lucide-react";
import {
  getAllQuestsWithStatus,
  getUserQuestsXp,
  autoCheckExistingQuests,
  shouldShowOnboardingQuests,
  type UserQuest,
  type QuestId,
} from "../../services/userQuests";
import { progressionEventBus } from "../../services/progressionEvents";

interface HomeOnboardingQuestsProps {
  userId?: string | null;
  userProfile?: any;
  userLevel?: number;
  hasFriends: boolean;
  totalGames: number;
  favoritesCount: number;
  hasAchievements: boolean;
  hasSteamConnected: boolean;
  hasEpicConnected: boolean;
  hasDiscordConnected: boolean;
  onOpenAddFriend: () => void;
  onOpenAddGame: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenTrophies: () => void;
  onScrollToGames?: () => void;
  playSound?: (sound: any) => void;
  isModal?: boolean;
  onClose?: () => void;
}

const QUEST_ICONS: Record<string, React.ReactNode> = {
  Users: <Users className="h-4 w-4" />,
  Gamepad2: <Gamepad2 className="h-4 w-4" />,
  Link: <Link className="h-4 w-4" />,
  Sparkles: <Sparkles className="h-4 w-4" />,
  Star: <Star className="h-4 w-4" />,
  Play: <Play className="h-4 w-4" />,
  Trophy: <Trophy className="h-4 w-4" />,
};

export const HomeOnboardingQuests: React.FC<HomeOnboardingQuestsProps> = ({
  userId,
  userProfile,
  userLevel,
  hasFriends,
  totalGames,
  favoritesCount,
  hasAchievements,
  hasSteamConnected,
  hasEpicConnected,
  hasDiscordConnected,
  onOpenAddFriend,
  onOpenAddGame,
  onOpenSettings,
  onOpenProfile,
  onOpenTrophies,
  onScrollToGames,
  playSound,
  isModal,
  onClose,
}) => {
  const [revision, setRevision] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  const storageDismissKey = useMemo(() => {
    return userId ? `phelierium_quests_dismissed:${userId}` : null;
  }, [userId]);

  // Verificar elegibilidade: apenas usuários novos na plataforma visualizam as missões
  const isEligible = useMemo(() => {
    if (!userId) return false;
    return shouldShowOnboardingQuests(userId, userProfile, {
      totalGames,
      level: userLevel,
    });
  }, [userId, userProfile, totalGames, userLevel, revision]);

  // Verificar se o usuário já dispensou o painel
  useEffect(() => {
    if (storageDismissKey) {
      const dismissed = localStorage.getItem(storageDismissKey);
      if (dismissed === "1") {
        setIsDismissed(true);
      }
    }
  }, [storageDismissKey]);

  // Auto-verificação periódica de ações concluídas apenas se elegível
  useEffect(() => {
    if (!userId || !isEligible) return;
    autoCheckExistingQuests(userId, {
      hasSteam: hasSteamConnected,
      hasEpic: hasEpicConnected,
      hasDiscord: hasDiscordConnected,
      gamesCount: totalGames,
      friendsCount: hasFriends ? 1 : 0,
      favoritesCount,
      achievementsCount: hasAchievements ? 1 : 0,
    });
  }, [
    userId,
    isEligible,
    hasSteamConnected,
    hasEpicConnected,
    hasDiscordConnected,
    totalGames,
    hasFriends,
    favoritesCount,
    hasAchievements,
  ]);

  // Escutar eventos de XP ou conclusão de missões em tempo real
  useEffect(() => {
    const handleQuestUpdate = () => setRevision((r) => r + 1);
    const unsub = progressionEventBus.onXpGained(handleQuestUpdate);
    window.addEventListener("checkpoint:xp-gained", handleQuestUpdate);
    return () => {
      unsub();
      window.removeEventListener("checkpoint:xp-gained", handleQuestUpdate);
    };
  }, []);

  const quests = useMemo(() => {
    if (!userId) return [];
    // revision garante reavaliação imediata
    void revision;
    return getAllQuestsWithStatus(userId);
  }, [userId, revision]);

  const completedCount = useMemo(() => quests.filter((q) => q.completed).length, [quests]);
  const totalCount = quests.length;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const earnedXp = useMemo(() => (userId ? getUserQuestsXp(userId) : 0), [userId, revision]);

  const handleDismiss = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      if (storageDismissKey) {
        localStorage.setItem(storageDismissKey, "1");
      }
      setIsDismissed(true);
    }
    playSound?.("back");
  }, [storageDismissKey, playSound, onClose]);

  const handleAction = useCallback(
    (questId: QuestId) => {
      playSound?.("select");
      if (isModal && onClose) {
        onClose();
      }
      switch (questId) {
        case "first_friend":
          onOpenAddFriend();
          break;
        case "first_game":
          onOpenAddGame();
          break;
        case "connect_platform":
          onOpenSettings();
          break;
        case "customize_profile":
          onOpenProfile();
          break;
        case "first_trophy":
          onOpenTrophies();
          break;
        case "favorite_game":
        case "launch_game":
          onScrollToGames?.();
          break;
      }
    },
    [
      onOpenAddFriend,
      onOpenAddGame,
      onOpenSettings,
      onOpenProfile,
      onOpenTrophies,
      onScrollToGames,
      playSound,
      isModal,
      onClose,
    ]
  );

  // Fecha modal com Escape
  useEffect(() => {
    if (!isModal || !onClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModal, onClose]);

  // Não renderiza se o usuário não estiver logado, já tiver dispensado, ou não for elegível (apenas novos usuários)
  if (!userId || (isDismissed && !isModal) || totalCount === 0 || !isEligible) {
    return null;
  }

  const cardContent = (
    <motion.section
      initial={{ opacity: 0, scale: isModal ? 0.96 : 1, y: isModal ? 0 : -12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: isModal ? 0.96 : 1, y: isModal ? 0 : -12 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-[16px] border border-[#292d30] bg-black p-5 sm:p-6 relative overflow-hidden ${
        isModal
          ? "w-full max-w-5xl max-h-[85vh] overflow-y-auto thin-scrollbar"
          : "mx-6 sm:mx-10 mb-8"
      }`}
      onClick={(e) => isModal && e.stopPropagation()}
    >
      {/* Glow de fundo âmbar e ciano */}
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Compass className="h-5 w-5 animate-[spin_18s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Guia de Iniciação & Missões
              </h2>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                Novos Jogadores
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Complete os passos para subir de nível instantaneamente e liberar novas patentes.
            </p>
          </div>
        </div>

        {/* Status + Ações do cabeçalho */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-1.5 backdrop-blur-md">
            <div className="flex flex-col">
              <span className="text-[11px] font-extrabold text-white">
                {completedCount} de {totalCount} Concluídas
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-400">
                +{earnedXp} XP Acumulado
              </span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <span className="font-mono text-xs font-black text-amber-400">
              {progressPercent}%
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neutral-400 hover:bg-white/10 hover:text-white transition"
            title={isExpanded ? "Recolher missões" : "Expandir missões"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neutral-400 hover:bg-white/10 hover:text-white transition"
            title="Dispensar guia de missões"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Barra de Progresso Geral */}
      <div className="relative z-10 mt-4 h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-white"
        />
      </div>

      {/* Banner de Celebração quando 100% Concluído */}
      {isAllCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 mt-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <PartyPopper className="h-6 w-6 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-black text-white">
                Parabéns! Todas as missões iniciais foram concluídas!
              </p>
              <p className="text-xs text-neutral-300">
                Você já domina o Phelierium Hub e alcançou XP suficiente para avançar de patente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-black hover:bg-emerald-400 transition"
          >
            Ocultar Guia
          </button>
        </motion.div>
      )}

      {/* Grid de Missões */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-hidden"
          >
            {quests.map((q) => {
              const icon = QUEST_ICONS[q.iconName] || <Sparkles className="h-4 w-4" />;
              return (
                <div
                  key={q.id}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-300 ${
                    q.completed
                      ? "border-emerald-500/25 bg-emerald-950/15 opacity-80"
                      : "border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                  }`}
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 transition-colors ${
                          q.completed
                            ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                            : "border border-white/10 bg-white/[0.06] text-white/80 group-hover:border-amber-500/40 group-hover:text-amber-400"
                        }`}
                      >
                        {q.completed ? <CheckCircle2 className="h-4 w-4" /> : icon}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {q.instantLevelUp && !q.completed && (
                          <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-300">
                            ★ Level UP
                          </span>
                        )}
                        <span
                          className={`font-mono text-xs font-black ${
                            q.completed ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          +{q.xpReward} XP
                        </span>
                      </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="mt-3">
                      <h3
                        className={`text-xs sm:text-sm font-bold tracking-tight ${
                          q.completed ? "line-through text-neutral-400" : "text-white"
                        }`}
                      >
                        {q.title}
                      </h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-neutral-400 line-clamp-2">
                        {q.description}
                      </p>
                    </div>
                  </div>

                  {/* Ação ou Badge de Concluído */}
                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    {q.completed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Concluída
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAction(q.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white hover:text-black transition active:scale-95 group/btn"
                      >
                        <span>Realizar</span>
                        <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => {
          playSound?.("back");
          onClose?.();
        }}
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
};

export default HomeOnboardingQuests;
