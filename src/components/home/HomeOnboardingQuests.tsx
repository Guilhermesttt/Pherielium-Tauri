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
import { IconSwap } from "../ui/IconSwap";

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
      className={`rounded-[var(--corner-md)] bg-[var(--surface-raised)] ring-1 ring-[color:var(--border-subtle)] p-5 sm:p-6 relative overflow-hidden ${
        isModal
          ? "w-full max-w-5xl max-h-[85vh] overflow-y-auto thin-scrollbar"
          : "mx-6 sm:mx-10 mb-8"
      }`}
      onClick={(e) => isModal && e.stopPropagation()}
    >
      {/* Glow de fundo âmbar e ciano */}
            
      {/* Top Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--tone-3)] border border-transparent text-[rgb(var(--launcher-accent))]">
            <Compass className="h-5 w-5 animate-[spin_18s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[length:var(--step-3)] font-bold text-[var(--ink)]">
                Guia de Iniciação & Missões
              </h2>
              <span className="rounded-full border border-transparent bg-[var(--tone-3)] px-2.5 py-0.5 text-[length:var(--step-0)] font-semibold text-[rgb(var(--launcher-accent))]">
                Novos Jogadores
              </span>
            </div>
            <p className="text-[length:var(--step-0)] text-neutral-400 mt-0.5">
              Complete os passos para subir de nível instantaneamente e liberar novas patentes.
            </p>
          </div>
        </div>

        {/* Status + Ações do cabeçalho */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 rounded-[var(--corner-md)] bg-[var(--surface-base)] px-3.5 py-2">
            <div className="flex flex-col">
              <span className="text-[length:var(--step-0)] font-extrabold text-[var(--ink)]">
                {completedCount} de {totalCount} Concluídas
              </span>
              <span className="text-[length:var(--step-0)] font-semibold text-[rgb(var(--launcher-accent))]">
                +{earnedXp} XP Acumulado
              </span>
            </div>
            <div className="h-4 w-px bg-[var(--tone-3)]" />
            <span className="text-[length:var(--step-0)] font-semibold tabular-nums text-[rgb(var(--launcher-accent))]">
              {progressPercent}%
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--corner-sm)] border border-transparent bg-[var(--tone-3)] text-neutral-400 hover:bg-[var(--tone-4)] hover:text-[var(--ink)] transition"
            title={isExpanded ? "Recolher missões" : "Expandir missões"}
          >
            <IconSwap active={isExpanded} a={<ChevronDown className="h-4 w-4" />} b={<ChevronUp className="h-4 w-4" />} />
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--corner-sm)] border border-transparent bg-[var(--tone-3)] text-neutral-400 hover:bg-[var(--tone-4)] hover:text-[var(--ink)] transition"
            title="Dispensar guia de missões"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Barra de Progresso Geral */}
      <div className="relative z-10 mt-4 h-1.5 w-full rounded-full bg-[var(--tone-3)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-[var(--ink)]"
        />
      </div>

      {/* Banner de Celebração quando 100% Concluído */}
      {isAllCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 mt-5 flex items-center justify-between gap-4 rounded-[var(--corner-md)] bg-[var(--surface-overlay)] p-4"
        >
          <div className="flex items-center gap-3">
            <PartyPopper className="h-6 w-6 text-[rgb(var(--launcher-accent))] shrink-0" />
            <div>
              <p className="text-sm font-black text-[var(--ink)]">
                Parabéns! Todas as missões iniciais foram concluídas!
              </p>
              <p className="text-[length:var(--step-0)] text-neutral-300">
                Você já domina o Phelierium Hub e alcançou XP suficiente para avançar de patente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-[var(--corner-sm)] bg-[var(--ink)] px-4 py-2 text-[length:var(--step-0)] font-black text-[var(--tone-0)] hover:bg-[rgb(var(--launcher-accent))] transition"
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
                  className={`group relative flex flex-col justify-between rounded-[var(--corner-md)] border p-4 transition-all duration-300 ${
                    q.completed
                      ? "border-transparent bg-[var(--tone-3)] opacity-80"
                      : "border-transparent bg-[var(--tone-3)] hover:border-transparent hover:bg-[var(--tone-4)]"
                  }`}
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-[var(--corner-sm)] shrink-0 transition-colors ${
                          q.completed
                            ? "border border-transparent bg-[var(--tone-3)] text-[rgb(var(--launcher-accent))]"
                            : "border border-transparent bg-[var(--tone-3)] text-[var(--ink)] group-hover:border-transparent group-hover:text-[rgb(var(--launcher-accent))]"
                        }`}
                      >
                        {q.completed ? <CheckCircle2 className="h-4 w-4" /> : icon}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {q.instantLevelUp && !q.completed && (
                          <span className="rounded-[10px] border border-transparent bg-[var(--tone-3)] px-1.5 py-0.5 text-[length:var(--step-0)] font-semibold text-[var(--ink)]">
                            ★ Level UP
                          </span>
                        )}
                        <span
                          className={`text-[length:var(--step-0)] font-semibold tabular-nums ${
                            q.completed ? "text-[rgb(var(--launcher-accent))]" : "text-[rgb(var(--launcher-accent))]"
                          }`}
                        >
                          +{q.xpReward} XP
                        </span>
                      </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="mt-3">
                      <h3
                        className={`text-[length:var(--step-1)] font-semibold ${
                          q.completed ? "line-through text-neutral-400" : "text-[var(--ink)]"
                        }`}
                      >
                        {q.title}
                      </h3>
                      <p className="mt-1 text-[length:var(--step-0)] leading-relaxed text-neutral-400 line-clamp-2">
                        {q.description}
                      </p>
                    </div>
                  </div>

                  {/* Ação ou Badge de Concluído */}
                  <div className="mt-4 pt-3 border-t border-transparent flex items-center justify-between">
                    {q.completed ? (
                      <span className="inline-flex items-center gap-1.5 text-[length:var(--step-0)] font-semibold text-[rgb(var(--launcher-accent))]">
                        <CheckCircle2 className="h-3 w-3" />
                        Concluída
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAction(q.id)}
                        className="inline-flex items-center gap-1.5 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-4 py-2 text-[length:var(--step-0)] font-semibold text-[var(--ink)] hover:bg-white hover:text-[var(--tone-0)] transition active:scale-95 group/btn"
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
