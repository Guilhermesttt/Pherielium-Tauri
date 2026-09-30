import React from "react";
import { Trophy, Search, AlertCircle, RotateCw, X, Lock } from "lucide-react";
import type { SteamAchievement } from "../../services/steam";
import type { AchievementFilter, GameDetailCopy } from "../../types/gameDetail";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { handleCursorGlow } from "../ui/cursor-glow";
import {
  buildGameTierMap,
  extractAndProcessPlatinum,
  type UnifiedTierAssignment,
} from "../../utils/trophyTiers";

// ── Imports dos logos Pherielium por tier ──────────────────────────────────────
import bronzeLogo from "../../assets/Pherielium_Logo_Bronze.png";
import prataLogo from "../../assets/Pherielium_Logo_Prata.png";
import ouroLogo from "../../assets/Pherielium_Logo_Ouro.png";
import platinaLogo from "../../assets/Pherielium_Logo_Platina.png";

// ── Config visual de cada tier ────────────────────────────────────────────────
export const ACHIEVEMENT_TIER_CONFIGS = [
  {
    id: "platinum",
    label: "Platina",
    logo: platinaLogo,
    color: "#38bdf8",
    colorClass: "text-[#38bdf8]",
    bg: "rgba(56,189,248,0.06)",
    bgClass: "bg-[#38bdf8]/[0.06]",
    border: "rgba(56,189,248,0.25)",
    borderClass: "border-[#38bdf8]/25",
    glow: "",
    glowClass: "",
    badgeBg: "rgba(56,189,248,0.12)",
  },
  {
    id: "gold",
    label: "Ouro",
    logo: ouroLogo,
    color: "#fbbf24",
    colorClass: "text-[#fbbf24]",
    bg: "rgba(251,191,36,0.06)",
    bgClass: "bg-[#fbbf24]/[0.06]",
    border: "rgba(251,191,36,0.25)",
    borderClass: "border-[#fbbf24]/25",
    glow: "",
    glowClass: "",
    badgeBg: "rgba(251,191,36,0.12)",
  },
  {
    id: "silver",
    label: "Prata",
    logo: prataLogo,
    color: "#e2e8f0",
    colorClass: "text-[#e2e8f0]",
    bg: "rgba(226,232,240,0.04)",
    bgClass: "bg-[#e2e8f0]/[0.04]",
    border: "rgba(226,232,240,0.20)",
    borderClass: "border-[#e2e8f0]/20",
    glow: "",
    glowClass: "",
    badgeBg: "rgba(226,232,240,0.10)",
  },
  {
    id: "bronze",
    label: "Bronze",
    logo: bronzeLogo,
    color: "#cd7f32",
    colorClass: "text-[#cd7f32]",
    bg: "rgba(205,127,50,0.04)",
    bgClass: "bg-[#cd7f32]/[0.04]",
    border: "rgba(205,127,50,0.18)",
    borderClass: "border-[#cd7f32]/18",
    glow: "",
    glowClass: "",
    badgeBg: "rgba(205,127,50,0.10)",
  },
  {
    id: "iron",
    label: "",
    logo: null,
    color: "#71797E",
    colorClass: "text-[#71797E]",
    bg: "rgba(113,121,126,0.03)",
    bgClass: "bg-[#71797E]/[0.03]",
    border: "rgba(113,121,126,0.12)",
    borderClass: "border-[#71797E]/12",
    glow: "",
    glowClass: "",
    badgeBg: "rgba(113,121,126,0.08)",
  },
] as const;

type TierConfig = typeof ACHIEVEMENT_TIER_CONFIGS[number];

function getTierConfig(tierIndex: number): TierConfig {
  return ACHIEVEMENT_TIER_CONFIGS[Math.min(tierIndex, ACHIEVEMENT_TIER_CONFIGS.length - 1)] as TierConfig;
}

// ── Utilidade: resolve o tier de uma conquista a partir do mapa ───────────────
function resolveTierIndex(
  ach: SteamAchievement,
  tierMap: Map<string, UnifiedTierAssignment>,
): number {
  const key = ach.apiName || ach.name || "";
  return tierMap.get(key)?.tierIndex ?? 3; // fallback bronze
}

// ── Componente Skeleton ───────────────────────────────────────────────────────
const AchievementSkeleton: React.FC = () => (
  <div className="h-[88px] flex items-center gap-4 animate-pulse p-4 rounded-2xl bg-[#141414] border border-white/[0.05]">
    <div className="w-14 h-14 rounded-xl bg-white/10 flex-shrink-0" />
    <div className="flex-1 space-y-2 min-w-0">
      <div className="h-4 w-1/3 bg-white/10 rounded" />
      <div className="h-3 w-1/2 bg-white/10 rounded" />
    </div>
    <div className="w-20 h-6 bg-white/10 rounded-lg flex-shrink-0" />
  </div>
);

// ── Badge de Tier com logo Pherielium ─────────────────────────────────────────
const TierBadge: React.FC<{ tierConfig: TierConfig; size?: "sm" | "md" }> = ({
  tierConfig,
  size = "sm",
}) => {
  if (!tierConfig.logo) return null;
  const dim = size === "md" ? "h-5 w-5" : "h-4 w-4";

  return (
    <div
      className={`flex items-center justify-center rounded-full ${dim}`}
      style={{ background: tierConfig.badgeBg }}
      title={tierConfig.label}
    >
      <img
        src={tierConfig.logo}
        alt={tierConfig.label}
        className="h-full w-full object-contain drop-shadow-sm"
      />
    </div>
  );
};

// ── Card do Troféu de Platina / Bloco de Conclusão da Coleção ────────────────
const PlatinumCard: React.FC<{
  isUnlocked: boolean;
  hasNative: boolean;
  name: string;
  description?: string;
  unlockDate: string | null;
  unlockedAtLabel: string;
  unlockedCount: number;
  totalCount: number;
  locale: string;
}> = ({
  isUnlocked,
  hasNative,
  name,
  description,
  unlockDate,
  unlockedAtLabel,
  unlockedCount,
  totalCount,
  locale,
}) => {
  const completionPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const isPt = locale.startsWith("pt");

  return (
    <div
      onMouseMove={handleCursorGlow}
      className={`cursor-glow relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-300 ${
        isUnlocked
          ? "border-[#38bdf8]/35 bg-[#14171a]"
          : "border-white/10 bg-[#141414]"
      }`}
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* Sutil iluminação quando desbloqueado */}
      {isUnlocked && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.12) 0%, transparent 70%)",
          }}
        />
      )}

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Bloco do Emblema de Platina */}
        <div
          className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-300"
          style={{
            background: isUnlocked ? "rgba(56,189,248,0.14)" : "rgba(255,255,255,0.03)",
            borderColor: isUnlocked ? "rgba(56,189,248,0.40)" : "rgba(255,255,255,0.10)",
          }}
        >
          <img
            src={platinaLogo}
            alt="Platina"
            className={`h-10 w-10 object-contain transition-all duration-300 ${
              isUnlocked ? "opacity-100 drop-shadow-md scale-105" : "opacity-80 grayscale contrast-125"
            }`}
          />
        </div>

        {/* Informações e Progresso Real da Coleção */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#38bdf8] flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {isPt ? "Conclusão da Coleção" : "Collection Completion"}
            </span>
            {!hasNative && (
              <span className="text-[9px] font-bold text-white/40 border border-white/10 rounded px-1.5 py-0.2 uppercase tracking-wider">
                Virtual
              </span>
            )}
          </div>

          <h3 className="font-bold text-base text-white tracking-wide">
            {name}
          </h3>

          <p className="text-xs text-white/70 leading-relaxed mt-0.5">
            {isUnlocked
              ? (isPt ? "Você completou 100% de todas as conquistas do jogo!" : "You have completed 100% of all achievements!")
              : (description || (isPt ? "Complete todas as conquistas para desbloquear" : "Complete all achievements to unlock"))}
          </p>

          {/* Barra de Progresso Real da Coleção */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50 font-medium">
                {isPt ? "Progresso geral" : "Overall progress"}
              </span>
              <span className="text-white font-bold tracking-tight">
                {unlockedCount} {isPt ? "de" : "of"} {totalCount} {isPt ? "desbloqueadas" : "unlocked"} ({completionPercent}%)
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(0, Math.min(100, completionPercent))}%`,
                  background: isUnlocked
                    ? "linear-gradient(90deg, #38bdf8, #0284c7)"
                    : "linear-gradient(90deg, #38bdf8cc, #38bdf888)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Status à direita */}
        <div className="shrink-0 flex sm:flex-col items-end justify-between sm:justify-center gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
          {isUnlocked ? (
            <div className="flex flex-col items-end gap-1">
              <span
                className="px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider text-[#38bdf8] border border-[#38bdf8]/40 bg-[#38bdf8]/15"
              >
                {isPt ? "Desbloqueado" : "Unlocked"}
              </span>
              {unlockDate && (
                <span className="text-[10px] text-white/40">
                  {unlockedAtLabel} {unlockDate}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <span className="px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider text-white/60 bg-white/[0.04] border border-white/10">
                {isPt ? "Em Progresso" : "In Progress"}
              </span>
              <span className="text-[10px] text-white/40">
                {totalCount - unlockedCount} {isPt ? "restantes" : "remaining"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Card individual de conquista ──────────────────────────────────────────────
const AchievementCard: React.FC<{
  achievement: SteamAchievement;
  tierIndex: number;
  lockedLabel: string;
  unlockedLabel: string;
  unlockedAtLabel: string;
  locale: string;
}> = React.memo(({ achievement, tierIndex, lockedLabel, unlockedLabel, unlockedAtLabel, locale }) => {
  const isAchieved = achievement.achieved;
  const tierCfg = getTierConfig(tierIndex);
  const isUltraRare = typeof achievement.percent === "number" && achievement.percent > 0 && achievement.percent < 1;

  const unlockDate = React.useMemo(() => {
    if (!achievement.unlockTime || achievement.unlockTime <= 0) return null;
    try {
      return new Date(achievement.unlockTime * 1000).toLocaleDateString(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }, [achievement.unlockTime, locale]);

  const globalRarityText = React.useMemo(() => {
    if (typeof achievement.percent !== "number" || achievement.percent <= 0) return null;
    const formatted = achievement.percent < 0.1
      ? achievement.percent.toFixed(2)
      : achievement.percent.toFixed(1);
    return locale.startsWith("pt")
      ? `${formatted}% dos jogadores`
      : `${formatted}% of players`;
  }, [achievement.percent, locale]);

  return (
    <div
      tabIndex={0}
      role="article"
      aria-label={isAchieved ? `${unlockedLabel}: ${achievement.name}` : `${lockedLabel}: ${achievement.name}`}
      onMouseMove={handleCursorGlow}
      className={`cursor-glow group relative flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${
        isAchieved
          ? "bg-[#141414] hover:bg-[#181818] border border-white/[0.06] hover:border-white/20"
          : "bg-[#111111] hover:bg-[#151515] border border-white/[0.04] hover:border-white/15"
      }`}
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Detalhe sutil de superfície (accent discreto na lateral esquerda para conquistas obtidas) */}
      {isAchieved && (
        <div
          className="absolute left-0 top-3.5 bottom-3.5 w-1 rounded-r-full transition-opacity duration-200"
          style={{ backgroundColor: tierCfg.color, opacity: 0.8 }}
        />
      )}

      {/* Arte da conquista: maior (h-14 w-14), isolada, sem nenhum emblema sobreposto */}
      <div className="relative shrink-0 h-14 w-14 rounded-xl border border-white/10 overflow-hidden bg-black/50 flex items-center justify-center">
        {achievement.icon || achievement.iconGray ? (
          <img
            src={isAchieved ? achievement.icon : achievement.iconGray || achievement.icon}
            alt=""
            className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              isAchieved ? "opacity-100" : "grayscale brightness-75 opacity-70"
            }`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          isAchieved ? (
            <Trophy className="h-6 w-6" style={{ color: tierCfg.color }} />
          ) : (
            <Lock className="h-5 w-5 text-white/40" />
          )
        )}
      </div>

      {/* Conteúdo Central: Nome em destaque, Requisito legível, Data secundária */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className={`font-bold text-sm tracking-tight truncate ${isAchieved ? "text-white" : "text-white/90"}`}>
            {achievement.name}
          </h4>
          {isUltraRare && isAchieved && (
            <span
              className="shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md"
              style={{
                background: "rgba(251,191,36,0.12)",
                color: "#fbbf24",
                border: "1px solid rgba(251,191,36,0.25)",
              }}
            >
              Ultra-Raro
            </span>
          )}
        </div>

        {/* Requisito com alto contraste para leitura */}
        <p className={`text-xs leading-relaxed line-clamp-2 ${isAchieved ? "text-white/70" : "text-white/65"}`}>
          {achievement.description || (isAchieved ? unlockedLabel : lockedLabel)}
        </p>

        {/* Data secundária abaixo do requisito */}
        {isAchieved && unlockDate && (
          <span className="text-[11px] text-white/40 font-medium block mt-1">
            {unlockedAtLabel} {unlockDate}
          </span>
        )}
      </div>

      {/* Lado Direito: Um único emblema de tier acompanhado de texto de raridade global */}
      <div className="shrink-0 flex flex-col items-end justify-center gap-1.5 min-w-[96px]">
        {isAchieved && tierCfg.logo ? (
          <div
            className="flex items-center justify-center h-8 w-8 rounded-xl border transition-all duration-200 group-hover:scale-105"
            style={{
              background: tierCfg.badgeBg,
              borderColor: tierCfg.border,
            }}
            title={tierCfg.label}
          >
            <img
              src={tierCfg.logo}
              alt={tierCfg.label}
              className="h-5 w-5 object-contain drop-shadow-sm"
            />
          </div>
        ) : isAchieved ? (
          <span
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: tierCfg.badgeBg,
              color: tierCfg.color,
              border: `1px solid ${tierCfg.border}`,
            }}
          >
            {tierCfg.label || unlockedLabel}
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white/40 bg-white/[0.03] border border-white/10">
            {lockedLabel}
          </span>
        )}

        {/* Texto explícito: "2.0% dos jogadores" */}
        {globalRarityText && (
          <span className="text-[11px] text-white/50 font-medium whitespace-nowrap">
            {globalRarityText}
          </span>
        )}
      </div>
    </div>
  );
});

AchievementCard.displayName = "AchievementCard";

// ── Painel de resumo de tiers ─────────────────────────────────────────────────
const TierSummary: React.FC<{
  achievements: SteamAchievement[];
  tierMap: Map<string, UnifiedTierAssignment>;
}> = ({ achievements, tierMap }) => {
  const counts = React.useMemo(() => {
    const c = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
    const uc = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
    for (const ach of achievements) {
      const key = ach.apiName || ach.name || "";
      const info = tierMap.get(key);
      const tierIdx = info?.tierIndex ?? 3;
      if (tierIdx === 0) { c.platinum++; if (ach.achieved) uc.platinum++; }
      else if (tierIdx === 1) { c.gold++; if (ach.achieved) uc.gold++; }
      else if (tierIdx === 2) { c.silver++; if (ach.achieved) uc.silver++; }
      else { c.bronze++; if (ach.achieved) uc.bronze++; }
    }
    return { total: c, unlocked: uc };
  }, [achievements, tierMap]);

  const tiers = [
    { cfg: ACHIEVEMENT_TIER_CONFIGS[0], total: counts.total.platinum + 1, unlocked: counts.unlocked.platinum }, // +1 por causa da platina virtual
    { cfg: ACHIEVEMENT_TIER_CONFIGS[1], total: counts.total.gold, unlocked: counts.unlocked.gold },
    { cfg: ACHIEVEMENT_TIER_CONFIGS[2], total: counts.total.silver, unlocked: counts.unlocked.silver },
    { cfg: ACHIEVEMENT_TIER_CONFIGS[3], total: counts.total.bronze, unlocked: counts.unlocked.bronze },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {tiers.map(({ cfg, total, unlocked }) => (
        <div key={cfg.id} className="flex items-center gap-1.5">
          {cfg.logo && (
            <img src={cfg.logo} alt={cfg.label} className="h-4 w-4 object-contain" />
          )}
          <span className="text-xs font-bold" style={{ color: unlocked > 0 ? cfg.color : "rgba(255,255,255,0.25)" }}>
            {unlocked}
          </span>
          <span className="text-xs text-white/25">/{total}</span>
        </div>
      ))}
    </div>
  );
};

// ── Props do componente principal ─────────────────────────────────────────────
interface GameDetailAchievementsProps {
  achievements: SteamAchievement[];
  isLoading: boolean;
  error: string | null;
  filter: AchievementFilter;
  searchQuery: string;
  copy: GameDetailCopy;
  locale: string;
  onFilterChange: (filter: AchievementFilter) => void;
  onSearchChange: (search: string) => void;
  onRetry: () => void;
  playSound: (type: SoundEffectType) => void;
}

// ── Componente principal ──────────────────────────────────────────────────────
export const GameDetailAchievements: React.FC<GameDetailAchievementsProps> = React.memo(({
  achievements,
  isLoading,
  error,
  filter,
  searchQuery,
  copy,
  locale,
  onFilterChange,
  onSearchChange,
  onRetry,
  playSound,
}) => {
  // Calcular mapa de tiers uma vez para toda a lista
  const tierMap = React.useMemo(() => buildGameTierMap(achievements), [achievements]);

  // Extrair info de platina
  const platinumInfo = React.useMemo(
    () => extractAndProcessPlatinum(achievements),
    [achievements],
  );

  // Conquistas base (sem a nativa de platina, se existir)
  const baseAchievements = platinumInfo.baseAchievements as SteamAchievement[];

  const filteredAchievements = React.useMemo(() => {
    return baseAchievements.filter((ach) => {
      if (filter === "unlocked" && !ach.achieved) return false;
      if (filter === "locked" && ach.achieved) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = ach.name.toLowerCase().includes(q);
        const matchesDesc = (ach.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [baseAchievements, filter, searchQuery]);

  const unlockedCount = React.useMemo(
    () => baseAchievements.filter((a) => a.achieved).length,
    [baseAchievements],
  );
  const lockedCount = baseAchievements.length - unlockedCount;

  // Ordenar: desbloqueados primeiro, depois por tier (platina→bronze), depois por % global
  const sortedAchievements = React.useMemo(() => {
    return [...filteredAchievements].sort((a, b) => {
      // Desbloqueados primeiro
      if (a.achieved && !b.achieved) return -1;
      if (!a.achieved && b.achieved) return 1;
      // Por tier (menor índice = mais raro = primeiro)
      const tierA = resolveTierIndex(a, tierMap);
      const tierB = resolveTierIndex(b, tierMap);
      if (tierA !== tierB) return tierA - tierB;
      // Por raridade global (menor % = mais raro = primeiro)
      const pA = a.percent ?? 999;
      const pB = b.percent ?? 999;
      return pA - pB;
    });
  }, [filteredAchievements, tierMap]);

  // Data de desbloqueio da platina
  const platinumUnlockDate = React.useMemo(() => {
    const plat = platinumInfo.platinumTrophy;
    if (!plat.achieved || !plat.unlockTime || plat.unlockTime <= 0) return null;
    try {
      return new Date(plat.unlockTime * 1000).toLocaleDateString(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }, [platinumInfo, locale]);

  return (
    <div className="flex flex-col gap-5 w-full">

      {/* Header: resumo de tiers + filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          {/* Filtros */}
          <div className="flex items-center gap-2">
            {(["all", "unlocked", "locked"] as const).map((f) => {
              const isActive = filter === f;
              const labels = { all: copy.filterAll, unlocked: copy.filterUnlocked, locked: copy.filterLocked };
              const counts = { all: achievements.length, unlocked: unlockedCount, locked: lockedCount };
              return (
                <button
                  key={f}
                  onClick={() => { onFilterChange(f); playSound("navigate"); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "text-black shadow-md"
                      : "bg-[var(--color-surface)] text-white/50 hover:text-white border border-white/5"
                  }`}
                  style={isActive ? {
                    background: "rgb(var(--launcher-accent))",
                    boxShadow: "0 0 12px rgb(var(--launcher-accent) / 0.35)",
                  } : undefined}
                >
                  {labels[f]} ({counts[f]})
                </button>
              );
            })}
          </div>

          {/* Resumo de tiers */}
          {achievements.length > 0 && !isLoading && (
            <TierSummary achievements={achievements} tierMap={tierMap} />
          )}
        </div>

        {/* Input de Busca */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className="w-full bg-[var(--color-surface)] border border-white/10 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Troféu de Platina / Bloco de Conclusão da Coleção */}
      {!isLoading && !error && achievements.length > 0 && (filter === "all" || (filter === "unlocked" && platinumInfo.isUnlocked) || (filter === "locked" && !platinumInfo.isUnlocked)) && (
        <PlatinumCard
          isUnlocked={platinumInfo.isUnlocked}
          hasNative={platinumInfo.hasNativePlatinum}
          name={platinumInfo.platinumTrophy.name || "Troféu de Platina"}
          description={platinumInfo.platinumTrophy.description}
          unlockDate={platinumUnlockDate}
          unlockedAtLabel={copy.achievementsUnlockedAt}
          unlockedCount={unlockedCount}
          totalCount={baseAchievements.length}
          locale={locale}
        />
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          <AchievementSkeleton />
          <AchievementSkeleton />
          <AchievementSkeleton />
        </div>
      )}

      {/* Erro com Retry */}
      {!isLoading && error && (
        <div className="glass-panel flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <AlertCircle className="mb-3 h-8 w-8 text-white/30" />
          <p className="text-sm font-semibold text-white/70 mb-4">{error}</p>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-surface)] border border-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            {copy.tryAgain}
          </button>
        </div>
      )}

      {/* Sem suporte a conquistas */}
      {!isLoading && !error && achievements.length === 0 && (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[var(--color-surface)] p-8 text-center">
          <Trophy className="mb-3 h-8 w-8 text-white/20" />
          <p className="text-sm font-bold text-white/70">{copy.achievementsNoSupportTitle}</p>
          <p className="mt-1 text-xs text-white/40 max-w-sm">{copy.achievementsNoSupportDesc}</p>
        </div>
      )}

      {/* Nenhum resultado na busca */}
      {!isLoading && !error && achievements.length > 0 && filteredAchievements.length === 0 && (
        <div className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-white/5 bg-black/20 p-6 text-center">
          <Search className="mb-2 h-6 w-6 text-white/30" />
          <p className="text-xs font-semibold text-white/60">{copy.noMatchingAchievements}</p>
        </div>
      )}

      {/* Lista de Conquistas */}
      {!isLoading && !error && sortedAchievements.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {sortedAchievements.map((ach) => (
            <AchievementCard
              key={ach.apiName || ach.name}
              achievement={ach}
              tierIndex={resolveTierIndex(ach, tierMap)}
              lockedLabel={copy.achievementsLocked}
              unlockedLabel={copy.achievementsUnlocked}
              unlockedAtLabel={copy.achievementsUnlockedAt}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
});

GameDetailAchievements.displayName = "GameDetailAchievements";
