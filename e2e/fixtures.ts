import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import type { BrowserContext } from "@playwright/test";

export const USER_ID = "00000000-0000-4000-8000-000000000001";

export const VIEWPORTS = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "2560x1440", width: 2560, height: 1440 },
] as const;

const NAMES = [
  "Hades II", "Hollow Knight", "Celeste", "Elden Ring", "Cyberpunk 2077",
  "The Witcher 3: Wild Hunt Complete Edition", "Stardew Valley", "Doom Eternal",
  "Hogwarts Legacy", "Red Dead Redemption 2", "Sekiro: Shadows Die Twice",
  "Baldur's Gate 3", "Dark Souls III", "Portal 2", "Half-Life: Alyx", "Control",
];

const PALETTE = ["#7c3aed", "#0ea5e9", "#f97316", "#10b981", "#e11d48", "#eab308", "#6366f1", "#14b8a6"];

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Capa sintética (gradiente + título) como data URI; sem rede. */
const cover = (title: string, i: number, w: number, h: number) => {
  const a = PALETTE[i % PALETTE.length];
  const b = PALETTE[(i + 3) % PALETTE.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<text x="50%" y="50%" fill="#fff" font-family="sans-serif" font-weight="800" font-size="${Math.round(w / 9)}" text-anchor="middle">${escapeXml(title.slice(0, 22))}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const LAUNCHERS = ["steam", "epic", "local"] as const;

export const makeGames = (count = 80) =>
  Array.from({ length: count }, (_, i) => {
    const base = NAMES[i % NAMES.length];
    const title = i < NAMES.length ? base : `${base} ${Math.floor(i / NAMES.length) + 1}`;
    const launcher = LAUNCHERS[i % LAUNCHERS.length];
    const portrait = cover(title, i, 600, 900);
    const recent = i < 6 ? new Date(Date.now() - i * 3_600_000).toISOString() : undefined;
    const data = {
      id: `game-${i}`,
      title,
      launcherType: launcher,
      hoursPlayed: (i % 7) * 1.3 + 0.9,
      isFavorite: i % 9 === 0,
      cardImage: portrait,
      image: portrait,
      backgroundImage: cover(title, i, 1920, 1080),
      // Os 6 primeiros contam como "jogados recentemente" (Continuar jogando).
      lastPlayedAt: recent,
      steamLastPlayedAt: recent,
      source: launcher === "local" ? "manual" : launcher,
      developer: "Estúdio Exemplo",
      tags: ["Ação", "Aventura"],
    };
    return {
      id: data.id,
      title,
      launcher_type: launcher,
      hours_played: data.hoursPlayed,
      steam_app_id: null,
      epic_catalog_id: null,
      is_favorite: data.isFavorite,
      data,
      updated_at: new Date().toISOString(),
    };
  });

const SUPABASE_REF = (() => {
  const env = readFileSync(path.resolve(import.meta.dirname, "../.env"), "utf8");
  const url = /^VITE_SUPABASE_URL=(.+)$/m.exec(env)?.[1]?.trim() ?? "";
  return new URL(url).hostname.split(".")[0];
})();

const session = () => ({
  access_token: "e2e-access-token",
  refresh_token: "e2e-refresh-token",
  token_type: "bearer",
  expires_in: 315_360_000,
  expires_at: Math.floor(Date.now() / 1000) + 315_360_000,
  user: {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "e2e@pherielium.test",
    app_metadata: { provider: "email" },
    user_metadata: { full_name: "Jogador E2E" },
    created_at: new Date().toISOString(),
  },
});

let tauriMockSource: string | undefined;
const getTauriMock = async () => {
  tauriMockSource ??= (
    await build({
      entryPoints: [path.resolve(import.meta.dirname, "tauri-mock.entry.ts")],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
    })
  ).outputFiles[0].text;
  return tauriMockSource;
};

export interface HarnessOptions {
  games?: ReturnType<typeof makeGames>;
  /** Pares chave/valor extras para o localStorage (ex.: abas de filtros). */
  localStorage?: Record<string, string>;
}

const CORS = { "access-control-allow-origin": "*" };

/** Mocka Tauri (mockIPC), sessão Supabase e REST. Tudo vive só em e2e/. */
export async function installHarness(context: BrowserContext, opts: HarnessOptions = {}) {
  const games = opts.games ?? makeGames();
  const storage: Record<string, string> = {
    [`sb-${SUPABASE_REF}-auth-token`]: JSON.stringify(session()),
    // Pula setup de instalação, animação de abertura e modal de novidades.
    pherielium_install_setup_v1: "1",
    [`checkpoint_game_boot_intro_${USER_ID}`]: "false",
    "checkpoint:last-seen-release": "1.0.0",
    [`phelierium_welcome_modal_seen_${USER_ID}`]: "1",
    ...(opts.localStorage ?? {}),
  };
  await context.addInitScript((list) => {
    (window as unknown as { __E2E_GAMES__: unknown[] }).__E2E_GAMES__ = list;
  }, games.map((row) => row.data));
  await context.addInitScript(await getTauriMock());
  await context.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
  }, storage);

  await context.route(
    (url) => url.hostname !== "127.0.0.1" && url.hostname !== "localhost",
    async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname.includes("/rest/v1/user_games")) {
        return route.fulfill({ json: games, headers: CORS });
      }
      if (pathname.includes("/auth/v1/user")) {
        return route.fulfill({ json: session().user, headers: CORS });
      }
      if (pathname.includes("/rest/v1/")) {
        return route.fulfill({ json: [], headers: CORS });
      }
      return route.abort();
    },
  );
}
