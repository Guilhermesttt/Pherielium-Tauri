import type { PlayerLevelInfo, PSNTierInfo } from "../utils/trophyTiers";

export interface LevelUpEventDetail {
  oldLevel: number;
  newLevel: number;
  levelInfo: PlayerLevelInfo;
  tierInfo?: PSNTierInfo;
}

export interface XpGainedEventDetail {
  xpGained: number;
  totalXp: number;
  levelInfo: PlayerLevelInfo;
  tierIndex?: number;
  gameId?: string;
}

export interface TrophyUnlockEventDetail {
  gameId: string;
  apiName: string;
  displayName?: string;
  tierIndex?: number;
  timestamp: number;
}

type LevelUpHandler = (detail: LevelUpEventDetail) => void;
type XpGainedHandler = (detail: XpGainedEventDetail) => void;
type TrophyUnlockHandler = (detail: TrophyUnlockEventDetail) => void;

class ProgressionEventBus {
  private levelUpListeners = new Set<LevelUpHandler>();
  private xpGainedListeners = new Set<XpGainedHandler>();
  private trophyUnlockListeners = new Set<TrophyUnlockHandler>();

  public onLevelUp(handler: LevelUpHandler): () => void {
    this.levelUpListeners.add(handler);
    return () => this.levelUpListeners.delete(handler);
  }

  public onXpGained(handler: XpGainedHandler): () => void {
    this.xpGainedListeners.add(handler);
    return () => this.xpGainedListeners.delete(handler);
  }

  public onTrophyUnlock(handler: TrophyUnlockHandler): () => void {
    this.trophyUnlockListeners.add(handler);
    return () => this.trophyUnlockListeners.delete(handler);
  }

  public emitLevelUp(detail: LevelUpEventDetail): void {
    // Notify typed in-memory subscribers
    for (const listener of this.levelUpListeners) {
      try {
        listener(detail);
      } catch (err) {
        console.error("[progressionEvents] Error in onLevelUp listener:", err);
      }
    }

    // Also dispatch to window for backward compatibility
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent<LevelUpEventDetail>("checkpoint:level-up", { detail })
        );
      } catch (err) {
        console.warn("[progressionEvents] Failed window dispatch checkpoint:level-up:", err);
      }
    }
  }

  public emitXpGained(detail: XpGainedEventDetail): void {
    for (const listener of this.xpGainedListeners) {
      try {
        listener(detail);
      } catch (err) {
        console.error("[progressionEvents] Error in onXpGained listener:", err);
      }
    }

    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent<XpGainedEventDetail>("checkpoint:xp-gained", { detail })
        );
      } catch (err) {
        console.warn("[progressionEvents] Failed window dispatch checkpoint:xp-gained:", err);
      }
    }
  }

  public emitTrophyUnlock(detail: TrophyUnlockEventDetail): void {
    for (const listener of this.trophyUnlockListeners) {
      try {
        listener(detail);
      } catch (err) {
        console.error("[progressionEvents] Error in onTrophyUnlock listener:", err);
      }
    }
  }
}

export const progressionEventBus = new ProgressionEventBus();
