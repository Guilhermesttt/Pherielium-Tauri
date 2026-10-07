import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

// Faz o app enxergar um runtime Tauri qualquer: todo comando responde `null`,
// exceto os que a home precisa para renderizar (biblioteca e listeners).
// `__E2E_GAMES__` é injetado por fixtures.ts antes deste script.
declare global {
  interface Window {
    __E2E_GAMES__?: unknown[];
  }
}

mockWindows("main");
let listenerId = 0;
mockIPC((cmd) => {
  if (cmd === "plugin:event|listen") return ++listenerId;
  if (cmd === "library_list") return window.__E2E_GAMES__ ?? [];
  return null;
});
