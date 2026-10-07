import { defineConfig } from "@playwright/test";

// Harness só de verificação visual: sobe o `vite` (porta 1420) e roda a home
// com Supabase + Tauri mockados (ver fixtures.ts e tauri-mock.entry.ts).
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 90_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:1420",
    colorScheme: "dark",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: "..",
  },
});
