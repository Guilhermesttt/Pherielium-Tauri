import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";
import { Toaster, toast } from "./ui/Shandc/toast";
import { soundThemes } from "../hooks/useSoundEffects";

export type NotificationType =
  | "success"
  | "error"
  | "info"
  | "warning"
  | "achievement"
  | "incoming-call"
  | "friend-request"
  | "friend-accepted"
  | "message";

export interface NotificationOptions {
  id?: string | number;
  title?: string;
  imageUrl?: string;
  duration?: number;
  sound?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  metadata?: Record<string, any>;
}

interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  defaultDuration: number;
  showInOverlay: boolean;
  types: Record<NotificationType, { enabled: boolean; duration?: number; sound?: boolean }>;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  soundEnabled: true,
  defaultDuration: 4200,
  showInOverlay: true,
  types: {
    success: { enabled: true, duration: 3000 },
    error: { enabled: true, duration: 6000, sound: true },
    info: { enabled: true, duration: 4200 },
    warning: { enabled: true, duration: 5000, sound: true },
    achievement: { enabled: true, duration: 8000, sound: true },
    "incoming-call": { enabled: true, duration: 0, sound: true },
    "friend-request": { enabled: true, duration: 10000, sound: true },
    "friend-accepted": { enabled: true, duration: 5000 },
    message: { enabled: true, duration: 6000, sound: true },
  },
};

interface NotificationContextValue {
  notify: (message: string, type?: NotificationType, options?: NotificationOptions) => void;
  preferences: NotificationPreferences;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  dismissAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem("notification_preferences");
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_PREFERENCES;
  });

  useEffect(() => {
    try {
      localStorage.setItem("notification_preferences", JSON.stringify(preferences));
    } catch {}
  }, [preferences]);

  const recentNotificationsRef = React.useRef<Map<string, number>>(new Map());
  const ANNOUNCE_TTL_MS = 3000;
  const [srAnnouncement, setSrAnnouncement] = React.useState<string | null>(null);

  const notify = useCallback(
    (message: string, type: NotificationType = "info", options?: NotificationOptions) => {
      if (!preferences.enabled) return;

      const typePrefs = preferences.types[type];
      if (typePrefs?.enabled === false) return;

      const duration = options?.duration ?? typePrefs?.duration ?? preferences.defaultDuration;
      const shouldPlaySound = options?.sound ?? typePrefs?.sound ?? preferences.soundEnabled;

      // Deduplicate identical notifications within a short TTL to avoid flood
      const dedupeKey = `${type}::${String(options?.title ?? "").slice(0, 100)}::${message.slice(0, 200)}`;
      const now = Date.now();
      const last = recentNotificationsRef.current.get(dedupeKey) ?? 0;
      if (now - last < ANNOUNCE_TTL_MS) {
        return;
      }
      recentNotificationsRef.current.set(dedupeKey, now);
      window.setTimeout(() => recentNotificationsRef.current.delete(dedupeKey), ANNOUNCE_TTL_MS + 50);

      // Overlay-specific kinds (messages, friend requests, calls, achievements)
      const isOverlayType =
        type === "incoming-call" ||
        type === "friend-request" ||
        type === "friend-accepted" ||
        type === "message" ||
        type === "achievement";

      const shortMessage = message.length > 500 ? `${message.slice(0, 497)}...` : message;

      // Accessibility: announce to screen readers
      setSrAnnouncement(`${options?.title ? options.title + ": " : ""}${shortMessage}`);

      if (isOverlayType && preferences.showInOverlay && window.electronAPI?.showNotificationOverlay) {
        void window.electronAPI.showNotificationOverlay({
          message: shortMessage,
          type,
          title: options?.title,
          imageUrl: options?.imageUrl,
          duration,
          sound: shouldPlaySound,
          action: options?.action ? { label: options.action.label, actionId: "custom" } : undefined,
          metadata: options?.metadata,
        });
      } else {
        const toastType =
          type === "achievement" ? "info" : type === "incoming-call" || type === "message" ? "info" : type;

        if (shouldPlaySound && preferences.soundEnabled) {
          try {
            const globalTheme = localStorage.getItem("checkpoint_sound_theme_global");
            let themeKey: keyof typeof soundThemes = "default";
            if (globalTheme && globalTheme in soundThemes) {
              themeKey = globalTheme as keyof typeof soundThemes;
            } else {
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith("checkpoint_sound_theme_")) {
                  const val = localStorage.getItem(k);
                  if (val && val in soundThemes) {
                    themeKey = val as keyof typeof soundThemes;
                    break;
                  }
                }
              }
            }

            let soundKey: keyof typeof soundThemes.default = "notification";

            if (type === "achievement") {
              const rawTier = String(options?.metadata?.tier || "").toLowerCase();
              const isPlatinum = rawTier === "platinum" || rawTier === "platina";
              const isGold = rawTier === "gold" || rawTier === "ouro";
              soundKey = isPlatinum
                ? "overlayAchievementPlatinum"
                : isGold
                  ? "overlayAchievementGold"
                  : "overlayAchievement";
            } else if (type === "message") {
              soundKey = "chatReceived";
            } else if (type === "friend-request" || type === "friend-accepted") {
              soundKey = "friendRequest";
            } else if (type === "incoming-call") {
              soundKey = "callEnter";
            } else {
              soundKey = "notification";
            }

            const soundUrl = (soundThemes[themeKey] as any)?.[soundKey] || soundThemes.default[soundKey];
            if (soundUrl) {
              const audio = new Audio(soundUrl);
              audio.volume = 0.35;
              void audio.play().catch(() => {});
            }
          } catch {}
        }

        toast.add({
          title: options?.title,
          description: shortMessage,
          type: toastType as any,
          timeout: duration,
        });
      }
    },
    [preferences],
  );

  const updatePreferences = useCallback((newPrefs: Partial<NotificationPreferences>) => {
    setPreferences((prev) => ({
      ...prev,
      ...newPrefs,
      types: newPrefs.types ? { ...prev.types, ...newPrefs.types } : prev.types,
    }));
  }, []);

  const dismissAll = useCallback(() => {
    if (window.electronAPI?.dismissNotificationOverlay) {
      void window.electronAPI.dismissNotificationOverlay({ dismissAll: true });
    }
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({ notify, preferences, updatePreferences, dismissAll }), [
    notify,
    preferences,
    updatePreferences,
    dismissAll,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster />
      {/* Screen reader announcement region (polite) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(1px, 1px, 1px, 1px)",
          whiteSpace: "nowrap",
          border: 0,
          padding: 0,
          margin: -1,
        }}
      >
        {srAnnouncement ?? ""}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification deve ser usado dentro de NotificationProvider");
  return ctx;
};
