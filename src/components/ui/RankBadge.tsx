import React from "react";
import type { PlayerLevelInfo } from "../../utils/trophyTiers";
import bronze from "../../assets/Pherielium_Tier_Bronze.png";
import silver from "../../assets/Pherielium_Tier_Prata.png";
import gold from "../../assets/Pherielium_Tier_Ouro.png";
import platinum from "../../assets/Pherielium_Tier_Platina.png";

const TIER_IMAGE: Record<PlayerLevelInfo["tier"], string> = { bronze, silver, gold, platinum };

export interface RankBadgeProps {
  level: Pick<PlayerLevelInfo, "level" | "tier" | "rank">;
  /** Altura da imagem do rank, em px; o número cresce junto. */
  size?: number;
  className?: string;
}

/**
 * Nível e rank numa peça só: a imagem do rank e, ao lado, o número do nível. O nome do rank fica
 * no `title` e no texto para leitor de tela, em vez de uma segunda leitura na tela.
 */
export const RankBadge: React.FC<RankBadgeProps> = ({ level, size = 56, className = "" }) => (
  <span className={`inline-flex items-center gap-3 ${className}`} title={`${level.rank} · nível ${level.level}`}>
    <img src={TIER_IMAGE[level.tier]} alt="" aria-hidden className="shrink-0 object-contain" style={{ height: size, width: size }} />
    <span className="font-metric font-semibold leading-none tabular-nums text-[var(--ink)]" style={{ fontSize: size * 0.62 }}>
      {level.level}
    </span>
    <span className="sr-only">
      Nível {level.level}, {level.rank}
    </span>
  </span>
);
