import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

// Faz o app enxergar um runtime Tauri qualquer: todo comando responde `null`,
// exceto os que a home precisa para renderizar (biblioteca e listeners).
// `__E2E_GAMES__` é injetado por fixtures.ts antes deste script.
declare global {
  interface Window {
    __E2E_GAMES__?: unknown[];
    __E2E_DRIVERS__?: { vigem?: boolean; hidHide?: boolean };
  }
}

mockWindows("main");
let listenerId = 0;

/** Perfil de controle devolvido ao harness: fábrica, vindo do global. */
const FACTORY_PROFILE = {
  deadzoneLeft: 0.08,
  deadzoneRight: 0.08,
  curve: "linear",
  sensitivity: 1,
  invertY: false,
  triggerThreshold: 0.12,
  swapAb: false,
  rumble: 0.8,
  emulateXinput: false,
};

// Estado dos drivers: `__E2E_DRIVERS__` deixa o teste simular "sem HidHide"
// (o caso que trava o toggle de emulação) sem precisar de driver nenhum.
const driverStatus = () => {
  const override = window.__E2E_DRIVERS__;
  const vigem = override?.vigem ?? true;
  const hidHide = override?.hidHide ?? true;
  return {
    vigem: { installed: vigem, supported: true, detail: null },
    hidHide: { installed: hidHide, supported: true, detail: null },
    emulationReady: vigem && hidHide,
  };
};

mockIPC((cmd, args) => {
  if (cmd === "plugin:event|listen") return ++listenerId;
  if (cmd === "library_list") return window.__E2E_GAMES__ ?? [];
  if (cmd === "controller_profile_resolve") {
    return { settings: FACTORY_PROFILE, origin: "global" };
  }
  if (cmd === "controller_profile_save") {
    const next = (args as { settings?: unknown })?.settings ?? FACTORY_PROFILE;
    return { settings: next, origin: "game" };
  }
  if (cmd === "controller_profile_clear_game") {
    return { settings: FACTORY_PROFILE, origin: "global" };
  }
  if (cmd === "controller_driver_status") return driverStatus();
  if (cmd === "controller_profile_list_games") return [];
  if (cmd === "controller_profile_reset_global") {
    return { settings: FACTORY_PROFILE, origin: "factory" };
  }
  // O Rust é quem amostra a curva de verdade; aqui só precisa vir uma reta
  // crescente para o gráfico desenhar alguma coisa.
  if (cmd === "controller_curve_preview" || cmd === "controller_trigger_preview") {
    const n = Number((args as { samples?: number })?.samples ?? 64);
    return Array.from({ length: n }, (_, i) => i / (n - 1));
  }
  return null;
});
