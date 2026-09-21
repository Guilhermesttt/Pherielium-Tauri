// src/components/trophies/TrophyHistoryTimeline.tsx
// Activity Feed de Progressão: Timeline contínua com Insígnias 3D proprietárias, agrupamento por data e filtros cirúrgicos.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import {
  defaultTrophyHistory,
  type TrophyTier,
  type TrophyHistoryClient,
  type UserTrophy,
  type XpEvent,
  type PageOptions,
  type Page,
} from "../../services/trophyHistory";
import {
  TIER_LEVELS,
  calculateGameTrophyCounts,
  aggregateTrophyCounts,
  calculatePlayerLevel,
} from "../../utils/trophyTiers";
import { getHubCounts, getUserUnifiedLevel } from "../../utils/hubTrophies";
import { progressionEventBus } from "../../services/progressionEvents";
import type { Game } from "../../types/domain";

import PherieliumLogoBronze from "../../assets/Pherielium_Logo_Bronze.png";
import PherieliumLogoSilver from "../../assets/Pherielium_Logo_Prata.png";
import PherieliumLogoGold from "../../assets/Pherielium_Logo_Ouro.png";
import PherieliumLogoPlatinum from "../../assets/Pherielium_Logo_Platina.png";
import PherieliumTierBronze from "../../assets/Pherielium_Tier_Bronze.png";
import PherieliumTierSilver from "../../assets/Pherielium_Tier_Prata.png";
import PherieliumTierGold from "../../assets/Pherielium_Tier_Ouro.png";
import PherieliumTierPlatinum from "../../assets/Pherielium_Tier_Platina.png";

const TROPHY_LOGOS: Record<TrophyTier, string> = {
  platinum: PherieliumLogoPlatinum,
  gold: PherieliumLogoGold,
  silver: PherieliumLogoSilver,
  bronze: PherieliumLogoBronze,
};

const TIER_LABELS: Record<TrophyTier, string> = {
  platinum: "Platina",
  gold: "Ouro",
  silver: "Prata",
  bronze: "Bronze",
};

const TIER_ORDER: TrophyTier[] = ["platinum", "gold", "silver", "bronze"];

const ITEMS_PER_PAGE = 10;

type Tab = "trophies" | "xp";

/** Formata a data de forma relativa e elegante para o Activity Feed */
function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (diffMin < 1) return "Agora mesmo";
    if (diffMin < 60) return `há ${diffMin} min`;
    if (isToday) {
      if (diffHours < 5) return `há ${diffHours}h`;
      return `Hoje · ${timeStr}`;
    }
    if (isYesterday) return `Ontem · ${timeStr}`;
    if (diffDays < 7) return `há ${diffDays} dias`;

    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
    return `${day} ${month} · ${timeStr}`;
  } catch {
    return iso;
  }
}

/** Formata a data completa para exibição em tooltip */
function formatFullDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "full",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

/** Retorna o cabeçalho de nó da timeline por dia */
function getDateGroupHeader(iso: string | null): string {
  if (!iso) return "ANTERIOR";
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "HOJE";
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "ONTEM";
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
    return `${day} ${month}`;
  } catch {
    return "ANTERIOR";
  }
}

const copy = {
  title: "Atividade de Progressão",
  tabTrophies: "Troféus",
  tabXp: "Eventos de XP",
  allTiers: "Todos",
  period: "Período",
  since: "De",
  until: "Até",
  clear: "Limpar",
  refresh: "Atualizar dados",
  empty: "Nenhum evento registrado neste intervalo.",
  error: "Falha ao carregar o histórico de atividades.",
  showing: (start: number, end: number, total: number, kind: string) =>
    `Mostrando ${start}–${end} de ${total} ${kind}`,
  source: {
    trophy_unlock: "Troféu",
    level_milestone: "Marco de Nível",
    manual: "Concessão Manual",
    correction: "Ajuste de Saldo",
  } as Record<string, string>,
};

// ============================================================
// ROW DO ACTIVITY FEED DE TROFÉUS (Insígnia 3D + Cores Cirúrgicas)
// ============================================================

const TimelineTrophyRow = React.memo<{
  trophy: UserTrophy;
  idx: number;
}>(({ trophy, idx }) => {
  const tier = (trophy.trophy?.tier ?? "bronze") as TrophyTier;
  const logo = TROPHY_LOGOS[tier] || PherieliumLogoBronze;

  // Extrai nome do jogo e descrição semântica
  let gameTitle = String(trophy.metadata?.gameTitle || "");
  let milestoneTitle = "";
  const rawTitle = trophy.trophy?.title || "";

  if (rawTitle.includes(":")) {
    const parts = rawTitle.split(":");
    milestoneTitle = parts[0].trim();
    if (!gameTitle) gameTitle = parts.slice(1).join(":").trim();
  } else {
    milestoneTitle = rawTitle;
  }

  if (!gameTitle) {
    gameTitle = rawTitle;
  }

  const milestoneLabel = useMemo(() => {
    switch (tier) {
      case "platinum":
        return "Platina conquistada";
      case "gold":
        return "Ouro conquistado";
      case "silver":
        return "Prata conquistada";
      case "bronze":
      default:
        return "Bronze conquistado";
    }
  }, [tier]);

  const tierAccent = useMemo(() => {
    switch (tier) {
      case "platinum":
        return {
          borderL: "border-l-2 border-l-[#38bdf8]",
          xpColor: "text-[#38bdf8]",
          glow: "radial-gradient(circle, rgba(56,189,248,0.4) 0%, transparent 70%)",
        };
      case "gold":
        return {
          borderL: "border-l-2 border-l-amber-400",
          xpColor: "text-amber-400",
          glow: "radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)",
        };
      case "silver":
        return {
          borderL: "border-l-2 border-l-slate-300",
          xpColor: "text-slate-300",
          glow: "radial-gradient(circle, rgba(226,232,240,0.25) 0%, transparent 70%)",
        };
      case "bronze":
      default:
        return {
          borderL: "border-l-2 border-l-[#cd7f32]",
          xpColor: "text-[#f59e0b]",
          glow: "radial-gradient(circle, rgba(205,127,50,0.25) 0%, transparent 70%)",
        };
    }
  }, [tier]);

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx, 8) * 0.02 }}
      title={formatFullDate(trophy.unlocked_at)}
      className={`group relative flex items-center justify-between gap-4 rounded-xl border border-white/[0.05] bg-[#0E1012]/70 p-3 sm:p-3.5 hover:bg-[#131519] hover:border-white/10 transition-all ${tierAccent.borderL}`}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Insígnia 3D Hero Flutuante */}
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          <div
            className="absolute -inset-1.5 rounded-full blur-md opacity-40 group-hover:opacity-80 group-hover:scale-125 transition-all duration-300 pointer-events-none"
            style={{ background: tierAccent.glow }}
          />
          <img
            src={logo}
            alt={tier}
            width={38}
            height={38}
            className="h-9 w-9 object-contain shrink-0 transition-transform duration-300 group-hover:scale-110 select-none"
            loading="lazy"
          />
        </div>

        {/* Informações Editoriais */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="truncate text-xs sm:text-sm font-black text-white uppercase tracking-tight group-hover:text-white transition-colors">
              {gameTitle}
            </h4>
          </div>

          <p className="truncate text-xs text-neutral-400 font-normal">
            <span className="font-semibold text-neutral-300">{milestoneLabel}</span>
            {trophy.trophy?.description && (
              <>
                <span className="mx-1.5 text-neutral-600">·</span>
                <span>{trophy.trophy.description}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Lado Direito: XP cirúrgico + Timestamp relativo */}
      <div className="flex flex-col items-end shrink-0 pl-2">
        {typeof trophy.trophy?.xp_value === "number" && (
          <span className={`text-xs sm:text-sm font-mono font-black tabular-nums ${tierAccent.xpColor}`}>
            +{trophy.trophy.xp_value} XP
          </span>
        )}
        <time className="text-[10px] font-mono text-neutral-500 font-medium mt-0.5">
          {formatRelativeDate(trophy.unlocked_at)}
        </time>
      </div>
    </motion.li>
  );
});

// ============================================================
// ROW DO ACTIVITY FEED DE EVENTOS DE XP
// ============================================================

const TimelineXpRow = React.memo<{
  event: XpEvent;
  idx: number;
}>(({ event, idx }) => {
  const isLevelUp = event.source_type === "level_milestone";
  const sourceLabel = copy.source[event.source_type] ?? event.source_type;

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx, 8) * 0.02 }}
      title={formatFullDate(event.created_at)}
      className="group relative flex items-center justify-between gap-4 rounded-xl border border-white/[0.05] bg-[#0E1012]/70 p-3 sm:p-3.5 hover:bg-[#131519] hover:border-white/10 transition-all border-l-2 border-l-emerald-400/80"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
          <Sparkles className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">
              {sourceLabel}
            </span>
            {event.level_before != null && event.level_after != null && event.level_after > event.level_before && (
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
                Lv.{event.level_before} → Lv.{event.level_after}
              </span>
            )}
          </div>

          {event.reason && (
            <p className="truncate text-xs text-neutral-400 font-normal">{event.reason}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 pl-2">
        <span className="text-xs sm:text-sm font-mono font-black tabular-nums text-emerald-400">
          +{event.amount} XP
        </span>
        <time className="text-[10px] font-mono text-neutral-500 font-medium mt-0.5">
          {formatRelativeDate(event.created_at)}
        </time>
      </div>
    </motion.li>
  );
});

// ============================================================
// COMPONENTE PRINCIPAL: ACTIVITY FEED TIMELINE
// ============================================================

interface TrophyHistoryTimelineProps {
  userId: string;
  games?: Game[];
  client?: TrophyHistoryClient;
  initialTab?: Tab;
}

export const TrophyHistoryTimeline: React.FC<TrophyHistoryTimelineProps> = ({
  userId,
  games = [],
  client,
  initialTab = "trophies",
}) => {
  const api = client ?? defaultTrophyHistory;

  const [tab, setTab] = useState<Tab>(initialTab);
  const [tier, setTier] = useState<TrophyTier | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>(null);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [revision, setRevision] = useState(0);

  const [trophies, setTrophies] = useState<UserTrophy[]>([]);
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reavalia histórico sempre que novo XP ou troféu for ganho em tempo real
  useEffect(() => {
    const onProgress = () => setRevision((r) => r + 1);
    const unsub = progressionEventBus.onXpGained(onProgress);
    window.addEventListener("checkpoint:xp-gained", onProgress);
    return () => {
      unsub();
      window.removeEventListener("checkpoint:xp-gained", onProgress);
    };
  }, []);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setCurrentPage(1);
  };

  const handleTierChange = (newTier: TrophyTier | null) => {
    setTier(newTier);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setTier(null);
    setSince(null);
    setUntil(null);
    setIsPeriodOpen(false);
    setCurrentPage(1);
  };

  // Sintetiza apenas os troféus que foram conquistados com jogos iniciados pelo Hub
  const localSynthesizedTrophies = useMemo<UserTrophy[]>(() => {
    const list: UserTrophy[] = [];
    if (!userId) return list;

    // revision para reavaliação imediata
    void revision;

    for (const g of games || []) {
      const counts = getHubCounts(userId, g.id);
      const totalHubTrophies = counts.platinum + counts.gold + counts.silver + counts.bronze;
      if (totalHubTrophies === 0) continue;

      const unlockDate = g.lastPlayedAt || (g as any).updatedAt || new Date().toISOString();

      if (counts.platinum > 0) {
        list.push({
          id: `plat-${g.id}`,
          user_id: userId,
          trophy_id: `plat-${g.id}`,
          progress: 1,
          unlocked_at: unlockDate,
          notified_at: null,
          metadata: { gameTitle: g.title },
          trophy: {
            id: `plat-${g.id}`,
            code: `plat_${g.id}`,
            title: `Platina: ${g.title}`,
            description: `Completou 100% das conquistas do jogo no Phelierium Hub.`,
            tier: "platinum",
            xp_value: 300 * counts.platinum,
            category: "completion",
            icon_url: g.cardImage || g.image || null,
          },
        });
      }

      if (counts.gold > 0) {
        list.push({
          id: `gold-${g.id}`,
          user_id: userId,
          trophy_id: `gold-${g.id}`,
          progress: 1,
          unlocked_at: unlockDate,
          notified_at: null,
          metadata: { gameTitle: g.title },
          trophy: {
            id: `gold-${g.id}`,
            code: `gold_${g.id}`,
            title: `Troféu de Ouro: ${g.title}`,
            description: `${counts.gold} conquista(s) raras desbloqueadas no Hub (<5% global).`,
            tier: "gold",
            xp_value: counts.gold * 90,
            category: "achievement",
            icon_url: g.cardImage || g.image || null,
          },
        });
      }

      if (counts.silver > 0) {
        list.push({
          id: `silver-${g.id}`,
          user_id: userId,
          trophy_id: `silver-${g.id}`,
          progress: 1,
          unlocked_at: unlockDate,
          notified_at: null,
          metadata: { gameTitle: g.title },
          trophy: {
            id: `silver-${g.id}`,
            code: `silver_${g.id}`,
            title: `Troféu de Prata: ${g.title}`,
            description: `${counts.silver} conquista(s) incomuns desbloqueadas no Hub (5% a 10% global).`,
            tier: "silver",
            xp_value: counts.silver * 30,
            category: "achievement",
            icon_url: g.cardImage || g.image || null,
          },
        });
      }

      if (counts.bronze > 0) {
        list.push({
          id: `bronze-${g.id}`,
          user_id: userId,
          trophy_id: `bronze-${g.id}`,
          progress: 1,
          unlocked_at: unlockDate,
          notified_at: null,
          metadata: { gameTitle: g.title },
          trophy: {
            id: `bronze-${g.id}`,
            code: `bronze_${g.id}`,
            title: `Troféu de Bronze: ${g.title}`,
            description: `${counts.bronze} conquista(s) comuns desbloqueadas no Hub (>10% global).`,
            tier: "bronze",
            xp_value: counts.bronze * 15,
            category: "achievement",
            icon_url: g.cardImage || g.image || null,
          },
        });
      }
    }

    return list.sort((a, b) => {
      const at = a.unlocked_at ? Date.parse(a.unlocked_at) : 0;
      const bt = b.unlocked_at ? Date.parse(b.unlocked_at) : 0;
      return bt - at;
    });
  }, [games, userId, revision]);

  // Sintetiza eventos de XP de fallback apenas para jogos executados via Hub
  const localSynthesizedXpEvents = useMemo<XpEvent[]>(() => {
    const list: XpEvent[] = [];
    if (!userId) return list;

    void revision;
    const playerLevel = getUserUnifiedLevel(userId, games as any);

    for (const g of games || []) {
      const counts = getHubCounts(userId, g.id);
      const totalHubTrophies = counts.platinum + counts.gold + counts.silver + counts.bronze;
      if (totalHubTrophies === 0) continue;

      const unlockDate = g.lastPlayedAt || (g as any).updatedAt || new Date().toISOString();

      if (counts.platinum > 0) {
        list.push({
          id: `xp-plat-${g.id}`,
          user_id: userId,
          source_type: "trophy_unlock",
          source_id: null,
          amount: 300 * counts.platinum,
          level_before: Math.max(1, playerLevel.level - 1),
          level_after: playerLevel.level,
          reason: `Platina obtida em ${g.title} (Hub)`,
          metadata: { gameTitle: g.title },
          created_at: unlockDate,
        });
      }

      if (counts.gold > 0) {
        list.push({
          id: `xp-gold-${g.id}`,
          user_id: userId,
          source_type: "trophy_unlock",
          source_id: null,
          amount: counts.gold * 90,
          level_before: playerLevel.level,
          level_after: playerLevel.level,
          reason: `${counts.gold} troféu(s) de ouro em ${g.title} (Hub)`,
          metadata: { gameTitle: g.title },
          created_at: unlockDate,
        });
      }

      if (counts.silver > 0) {
        list.push({
          id: `xp-silver-${g.id}`,
          user_id: userId,
          source_type: "trophy_unlock",
          source_id: null,
          amount: counts.silver * 30,
          level_before: playerLevel.level,
          level_after: playerLevel.level,
          reason: `${counts.silver} troféu(s) de prata em ${g.title} (Hub)`,
          metadata: { gameTitle: g.title },
          created_at: unlockDate,
        });
      }

      if (counts.bronze > 0) {
        list.push({
          id: `xp-bronze-${g.id}`,
          user_id: userId,
          source_type: "trophy_unlock",
          source_id: null,
          amount: counts.bronze * 15,
          level_before: playerLevel.level,
          level_after: playerLevel.level,
          reason: `${counts.bronze} troféu(s) de bronze em ${g.title} (Hub)`,
          metadata: { gameTitle: g.title },
          created_at: unlockDate,
        });
      }
    }

    if (playerLevel.level > 1) {
      list.unshift({
        id: `xp-level-${playerLevel.level}`,
        user_id: userId,
        source_type: "level_milestone",
        source_id: null,
        amount: 500,
        level_before: playerLevel.level - 1,
        level_after: playerLevel.level,
        reason: `Alcançou o Nível ${playerLevel.level} (${playerLevel.rank})`,
        metadata: {},
        created_at: new Date().toISOString(),
      });
    }

    return list;
  }, [games, userId, revision]);

  const buildOptions = useCallback(
    (cursor: string | null): PageOptions => ({
      limit: 100,
      before: cursor,
      tier: tab === "trophies" ? tier : null,
      since,
      until,
    }),
    [tab, tier, since, until]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "trophies") {
        let remoteRows: UserTrophy[] = [];
        try {
          const page: Page<UserTrophy> = await api.fetchTrophies(userId, buildOptions(null));
          remoteRows = page.rows || [];
        } catch {
          remoteRows = [];
        }

        let combined = remoteRows.length > 0 ? remoteRows : localSynthesizedTrophies;

        if (tier) {
          combined = combined.filter((item) => item.trophy?.tier === tier);
        }
        if (since) {
          const sinceTime = new Date(since).getTime();
          combined = combined.filter(
            (item) => item.unlocked_at && new Date(item.unlocked_at).getTime() >= sinceTime
          );
        }
        if (until) {
          const untilTime = new Date(until).getTime();
          combined = combined.filter(
            (item) => item.unlocked_at && new Date(item.unlocked_at).getTime() <= untilTime
          );
        }

        setTrophies(combined);
        setXpEvents([]);
      } else {
        let remoteRows: XpEvent[] = [];
        try {
          const page: Page<XpEvent> = await api.fetchXpEvents(userId, buildOptions(null));
          remoteRows = page.rows || [];
        } catch {
          remoteRows = [];
        }

        let combined = remoteRows.length > 0 ? remoteRows : localSynthesizedXpEvents;

        if (since) {
          const sinceTime = new Date(since).getTime();
          combined = combined.filter(
            (item) => item.created_at && new Date(item.created_at).getTime() >= sinceTime
          );
        }
        if (until) {
          const untilTime = new Date(until).getTime();
          combined = combined.filter(
            (item) => item.created_at && new Date(item.created_at).getTime() <= untilTime
          );
        }

        setXpEvents(combined);
        setTrophies([]);
      }
    } catch (err: any) {
      setError(err?.message || copy.error);
    } finally {
      setLoading(false);
    }
  }, [tab, tier, since, until, userId, api, buildOptions, localSynthesizedTrophies, localSynthesizedXpEvents]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalItems = tab === "trophies" ? trophies.length : xpEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedTrophies = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return trophies.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [trophies, safeCurrentPage]);

  const paginatedXpEvents = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return xpEvents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [xpEvents, safeCurrentPage]);

  // Agrupamento temporal de itens por dia para criar a Timeline Contínua
  const dateGroups = useMemo(() => {
    if (tab === "trophies") {
      const groups: { dateLabel: string; items: UserTrophy[] }[] = [];
      let currentLabel = "";
      let currentItems: UserTrophy[] = [];

      for (const t of paginatedTrophies) {
        const label = getDateGroupHeader(t.unlocked_at);
        if (label !== currentLabel) {
          if (currentItems.length > 0) {
            groups.push({ dateLabel: currentLabel, items: currentItems });
          }
          currentLabel = label;
          currentItems = [t];
        } else {
          currentItems.push(t);
        }
      }
      if (currentItems.length > 0) {
        groups.push({ dateLabel: currentLabel, items: currentItems });
      }
      return groups;
    } else {
      const groups: { dateLabel: string; items: XpEvent[] }[] = [];
      let currentLabel = "";
      let currentItems: XpEvent[] = [];

      for (const e of paginatedXpEvents) {
        const label = getDateGroupHeader(e.created_at);
        if (label !== currentLabel) {
          if (currentItems.length > 0) {
            groups.push({ dateLabel: currentLabel, items: currentItems });
          }
          currentLabel = label;
          currentItems = [e];
        } else {
          currentItems.push(e);
        }
      }
      if (currentItems.length > 0) {
        groups.push({ dateLabel: currentLabel, items: currentItems });
      }
      return groups;
    }
  }, [tab, paginatedTrophies, paginatedXpEvents]);

  const isEmpty = totalItems === 0;
  const hasActiveFilters = tier !== null || since !== null || until !== null;

  return (
    <section
      className="rounded-3xl border border-white/[0.08] p-5 sm:p-6"
      style={{
        background: "linear-gradient(145deg, rgba(20,20,24,0.6) 0%, rgba(10,10,14,0.75) 100%)",
        backdropFilter: "blur(48px) saturate(160%)",
        WebkitBackdropFilter: "blur(48px) saturate(160%)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.06)",
      }}
      aria-label={copy.title}
    >
      {/* Cabeçalho Editorial com Underline Minimalista */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => handleTabChange("trophies")}
            className={`relative pb-2.5 text-xs font-bold transition-colors cursor-pointer ${
              tab === "trophies" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <span>{copy.tabTrophies}</span>
            {tab === "trophies" && (
              <motion.div
                layoutId="timelineTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("xp")}
            className={`relative pb-2.5 text-xs font-bold transition-colors cursor-pointer ${
              tab === "xp" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <span>{copy.tabXp}</span>
            {tab === "xp" && (
              <motion.div
                layoutId="timelineTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        </div>

        {/* Ação discreta de recarregar */}
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          title={copy.refresh}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition cursor-pointer disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-white" : ""}`} />
        </button>
      </div>

      {/* Barra de Filtros Cirúrgica e Leve */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Filtros de Tier */}
        {tab === "trophies" ? (
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleTierChange(null)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                tier === null
                  ? "bg-white/15 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {copy.allTiers}
            </button>
            {TIER_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTierChange(tier === t ? null : t)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  tier === t
                    ? "bg-white/15 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    t === "platinum"
                      ? "bg-[#38bdf8]"
                      : t === "gold"
                      ? "bg-amber-400"
                      : t === "silver"
                      ? "bg-slate-300"
                      : "bg-[#cd7f32]"
                  }`}
                />
                <span>{TIER_LABELS[t]}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs font-semibold text-neutral-400">
            Eventos e concessões de experiência do jogador
          </span>
        )}

        {/* Seletor de Período Discreto */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPeriodOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
              since || until
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/10 bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <Calendar className="h-3 w-3" />
            <span>
              {since || until
                ? `${since ? since.slice(8, 10) + "/" + since.slice(5, 7) : "Início"} - ${
                    until ? until.slice(8, 10) + "/" + until.slice(5, 7) : "Fim"
                  }`
                : copy.period}
            </span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            >
              <X className="h-3 w-3" />
              <span>{copy.clear}</span>
            </button>
          )}
        </div>
      </div>

      {/* Popover/Drawer de Período quando aberto */}
      <AnimatePresence>
        {isPeriodOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 flex flex-wrap items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-neutral-300"
          >
            <label className="flex items-center gap-2">
              <span className="text-neutral-500 font-medium">{copy.since}:</span>
              <input
                type="date"
                className="rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-white outline-none focus:border-white/30"
                value={since ? since.slice(0, 10) : ""}
                onChange={(e) => {
                  setSince(e.target.value ? new Date(e.target.value).toISOString() : null);
                  setCurrentPage(1);
                }}
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="text-neutral-500 font-medium">{copy.until}:</span>
              <input
                type="date"
                className="rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-white outline-none focus:border-white/30"
                value={until ? until.slice(0, 10) : ""}
                onChange={(e) => {
                  setUntil(e.target.value ? new Date(e.target.value).toISOString() : null);
                  setCurrentPage(1);
                }}
              />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      {isEmpty && !loading && !error ? (
        <div className="py-14 text-center space-y-2">
          <p className="text-sm font-bold text-neutral-300">
            Nenhum troféu desbloqueado via Hub ainda
          </p>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            Inicie seus jogos através do Phelierium Hub para conquistar troféus oficiais, registrar suas vitórias na timeline e acumular XP.
          </p>
        </div>
      ) : null}

      {/* Activity Timeline com Guia Vertical Contínua */}
      {!isEmpty && (
        <div className="relative pl-4 sm:pl-5 space-y-6 before:absolute before:left-1 sm:before:left-1.5 before:top-2.5 before:bottom-2.5 before:w-px before:bg-white/[0.08]">
          {dateGroups.map((group) => (
            <div key={group.dateLabel} className="space-y-2.5">
              {/* Nó de data da Timeline */}
              <div className="flex items-center gap-3 -ml-4 sm:-ml-5">
                <div className="h-2 w-2 rounded-full bg-white/70 ring-4 ring-[#0A0B0D]" />
                <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 uppercase">
                  {group.dateLabel}
                </span>
                <div className="h-px flex-1 bg-white/[0.05]" />
              </div>

              {/* Itens do grupo */}
              <ul className="space-y-2">
                {tab === "trophies"
                  ? (group.items as UserTrophy[]).map((t, idx) => (
                      <TimelineTrophyRow key={t.id} trophy={t} idx={idx} />
                    ))
                  : (group.items as XpEvent[]).map((e, idx) => (
                      <TimelineXpRow key={e.id} event={e} idx={idx} />
                    ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Paginação Minimalista */}
      {totalPages > 1 && (
        <footer className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <p className="text-[11px] font-mono text-neutral-500">
            {copy.showing(
              (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1,
              Math.min(safeCurrentPage * ITEMS_PER_PAGE, totalItems),
              totalItems,
              tab === "trophies" ? "troféus" : "eventos"
            )}
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-bold text-neutral-300 hover:bg-white/10 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Anterior</span>
            </button>

            <span className="px-2 text-xs font-mono font-bold text-neutral-400">
              {safeCurrentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-bold text-neutral-300 hover:bg-white/10 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <span>Próxima</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
};

export default TrophyHistoryTimeline;
