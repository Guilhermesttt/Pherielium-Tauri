import React, { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gamepad2, Battery, BatteryLow, BatteryCharging, Usb, Bluetooth, VibrateOff } from "lucide-react";
import { useGamepad, playHapticPattern } from "../../context/GamepadContext";
import { usePreferences } from "../../context/PreferencesContext";

type OverlayKind = "connected" | "disconnected" | "hapticsOn" | "hapticsOff" | "batteryLow" | "batteryStatus";

interface OverlayState {
  kind: OverlayKind;
  batteryLevel?: number | null;
  batteryCharging?: boolean;
}

export const GamepadStatusOverlay: React.FC = () => {
  const { isGamepadConnected, connectedGamepadId, batteryLevel, batteryCharging, connectionType, isLowBattery } = useGamepad();
  const { hapticsEnabled } = usePreferences();
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [show, setShow] = useState(false);
  const prevConnectedRef = useRef<boolean | null>(null);
  const prevHapticsRef = useRef<boolean | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const scheduleHide = (ms = 3000) => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setShow(false), ms);
  };

  const showOverlay = (state: OverlayState, ms = 3000) => {
    setOverlay(state);
    setShow(true);
    scheduleHide(ms);
  };

  // Listener para evento customizado de bateria fraca
  useEffect(() => {
    const handleLowBattery = (e: Event) => {
      const custom = e as CustomEvent<{ level: number; isCritical?: boolean }>;
      if (custom.detail) {
        showOverlay(
          {
            kind: "batteryLow",
            batteryLevel: custom.detail.level,
            batteryCharging: false,
          },
          4500
        );
        try { playHapticPattern("action"); } catch { }
      }
    };

    window.addEventListener("checkpoint:low-battery", handleLowBattery);
    return () => window.removeEventListener("checkpoint:low-battery", handleLowBattery);
  }, []);

  // Connected / disconnected
  useEffect(() => {
    if (prevConnectedRef.current === null) {
      prevConnectedRef.current = isGamepadConnected;
      return;
    }
    if (isGamepadConnected && prevConnectedRef.current !== true) {
      showOverlay({ kind: "connected", batteryLevel, batteryCharging }, 3000);
    } else if (!isGamepadConnected && prevConnectedRef.current !== false) {
      showOverlay({ kind: "disconnected" }, 3000);
    }
    prevConnectedRef.current = isGamepadConnected;
  }, [isGamepadConnected, batteryLevel, batteryCharging]);

  // Haptics toggle feedback
  useEffect(() => {
    if (prevHapticsRef.current === null) {
      prevHapticsRef.current = hapticsEnabled;
      return;
    }
    if (prevHapticsRef.current !== hapticsEnabled) {
      showOverlay({ kind: hapticsEnabled ? "hapticsOn" : "hapticsOff" }, 2600);
      if (hapticsEnabled) {
        try { playHapticPattern("action"); } catch { }
      }
      prevHapticsRef.current = hapticsEnabled;
    }
  }, [hapticsEnabled]);

  // Battery low warning
  useEffect(() => {
    if (!isGamepadConnected || batteryLevel === null || batteryCharging) return;
    if (batteryLevel > 20) return;
    const key = `checkpoint_low_bat_overlay_${batteryLevel}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.setTimeout(() => sessionStorage.removeItem(key), 600000);
    showOverlay({ kind: "batteryLow", batteryLevel, batteryCharging }, 4000);
    try { playHapticPattern("action"); } catch { }
  }, [batteryLevel, batteryCharging, isGamepadConnected]);

  // External trigger: Controle & Hardware -> Ver status button
  useEffect(() => {
    const handler = () => {
      if (!isGamepadConnected) {
        showOverlay({ kind: "disconnected" }, 3000);
      } else {
        showOverlay({ kind: "batteryStatus", batteryLevel, batteryCharging }, 3500);
      }
    };
    window.addEventListener("checkpoint:show-controller-status", handler);
    return () => window.removeEventListener("checkpoint:show-controller-status", handler);
  }, [isGamepadConnected, batteryLevel, batteryCharging]);

  // Test haptics button
  useEffect(() => {
    const handler = () => {
      if (!isGamepadConnected) {
        showOverlay({ kind: "disconnected" }, 2600);
        return;
      }
      if (!hapticsEnabled) {
        showOverlay({ kind: "hapticsOff" }, 2600);
        return;
      }
      showOverlay({ kind: "hapticsOn" }, 2600);
      try { playHapticPattern("action"); } catch { }
    };
    window.addEventListener("checkpoint:test-haptics", handler);
    return () => window.removeEventListener("checkpoint:test-haptics", handler);
  }, [isGamepadConnected, hapticsEnabled]);

  // Also listen for low-battery event from SettingsPage
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { level: number };
      showOverlay({ kind: "batteryLow", batteryLevel: detail.level, batteryCharging: false }, 4000);
    };
    window.addEventListener("checkpoint:low-battery", handler as EventListener);
    return () => window.removeEventListener("checkpoint:low-battery", handler as EventListener);
  }, []);

  const kind = overlay?.kind ?? (isGamepadConnected ? "connected" : "disconnected");
  const isConnected = kind === "connected" || kind === "hapticsOn" || kind === "batteryStatus";
  const isHaptics = kind === "hapticsOn" || kind === "hapticsOff";
  const isBatteryLow = kind === "batteryLow";
  const isBatteryStatus = kind === "batteryStatus";

  const connectionLabel = (() => {
    if (!isGamepadConnected) return "SEM SINAL";
    if (connectionType === "bluetooth") return "BLUETOOTH";
    if (connectionType === "usb") return batteryCharging ? "USB • CARREGANDO" : "USB";

    const id = (connectedGamepadId || "").toLowerCase();
    if (id.includes("bluetooth") || id.includes("bth")) return "BLUETOOTH";
    if (id.includes("wired") || id.includes("cabo")) return batteryCharging ? "USB • CARREGANDO" : "USB";
    return "CONECTADO";
  })();

  const title = (() => {
    if (kind === "hapticsOn") return "Vibração ligada";
    if (kind === "hapticsOff") return "Vibração desligada";
    if (kind === "batteryLow") return `Bateria baixa — ${overlay?.batteryLevel ?? batteryLevel}%`;
    if (kind === "batteryStatus") return isGamepadConnected ? "Status do controle" : "Controle desconectado";
    if (kind === "connected") return "Controle conectado";
    return "Controle desconectado";
  })();

  const subtitle = (() => {
    if (kind === "hapticsOn") return "O controle vai tremer com as interações";
    if (kind === "hapticsOff") return "Vibração desativada";
    if (kind === "batteryLow") return "Conecte o cabo para continuar jogando";

    if (kind === "batteryStatus" || kind === "connected") {
      if (!isGamepadConnected) return "SEM SINAL";

      // 1. Se estiver conectado via USB
      if (connectionType === "usb") {
        const lvl = batteryLevel !== null ? ` • ${batteryLevel}%` : "";
        return batteryCharging ? `USB • CARREGANDO${lvl}` : `USB • CONECTADO${lvl}`;
      }

      // 2. Se estiver conectado via Bluetooth
      if (connectionType === "bluetooth") {
        const lvl = batteryLevel !== null ? `${batteryLevel}%` : "--%";
        const chg = batteryCharging ? " • CARREGANDO" : "";
        return `BLUETOOTH • ${lvl}${chg}`;
      }

      // 3. Fallback inteligente baseado em ID
      const id = (connectedGamepadId || "").toLowerCase();
      if (id.includes("bluetooth") || id.includes("bth")) {
        const lvl = batteryLevel !== null ? ` • ${batteryLevel}%` : "";
        return `BLUETOOTH${lvl}`;
      }
      if (id.includes("wired") || id.includes("cabo")) {
        const lvl = batteryLevel !== null ? ` • ${batteryLevel}%` : "";
        return batteryCharging ? `USB • CARREGANDO${lvl}` : `USB • CONECTADO${lvl}`;
      }

      const lvl = batteryLevel !== null ? ` • ${batteryLevel}%` : "";
      return `CONECTADO${lvl}`;
    }

    return "SEM SINAL";
  })();

  // Icon shake config
  const iconShake = isHaptics && kind === "hapticsOn"
    ? { x: [0, -1.8, 1.8, -1.8, 1.8, 0], rotate: [0, -2, 2, -2, 0] }
    : isBatteryLow
      ? { x: [0, -1, 1, -1, 0] }
      : {};

  const iconTransition = isHaptics && kind === "hapticsOn"
    ? { duration: 0.5, repeat: 1, ease: "easeInOut" as const }
    : isBatteryLow
      ? { duration: 0.4, repeat: 2, ease: "easeInOut" as const }
      : { duration: 0.3 };

  const IconComp = (() => {
    if (kind === "hapticsOff") return VibrateOff;
    if (isBatteryLow) return BatteryLow;
    return Gamepad2;
  })();

  const iconColor = isBatteryLow
    ? "text-red-300"
    : kind === "hapticsOff"
      ? "text-white/35"
      : isConnected
        ? "text-white"
        : "text-white/35";

  const dotClass = isBatteryLow
    ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]"
    : kind === "hapticsOff"
      ? "bg-white/20"
      : isConnected
        ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
        : "bg-transparent border border-white/30";

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex flex-col items-center">
      <AnimatePresence>
        {show && overlay && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center gap-3 pl-3.5 pr-5 py-2.5 rounded-full backdrop-blur-2xl border border-white/[0.08] bg-white/[0.04] shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
          >
            <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.12]">
              <motion.span
                animate={
                  kind === "connected" || kind === "batteryStatus"
                    ? { scale: [1, 1.6, 1], opacity: [0.35, 0, 0.35] }
                    : { scale: 1, opacity: 0 }
                }
                transition={{ duration: 1.8, repeat: kind === "connected" || kind === "batteryStatus" ? Infinity : 0, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-white"
              />
              <motion.span
                animate={iconShake}
                transition={iconTransition}
                className="relative flex items-center justify-center"
              >
                <IconComp className={`w-4 h-4 transition-colors duration-300 ${iconColor}`} strokeWidth={2.25} />
              </motion.span>
            </span>

            <div className="flex flex-col leading-tight">
              <span className="font-display font-semibold text-[13px] tracking-tight text-white">
                {title}
              </span>
              <span className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${dotClass}`} />
                <span className="font-body text-[10px] uppercase tracking-[0.16em] text-white/40">
                  {subtitle}
                </span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
