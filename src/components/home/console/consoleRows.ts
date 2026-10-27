import type { Game } from "../../../types/domain";

/** Uma fileira de jogos da Home. */
export interface WallRow {
  id: string;
  title: string;
  games: Game[];
}

/** Posição de foco: fileira e coluna. */
export interface WallFocus {
  row: number;
  col: number;
}

/** Lojas reconhecidas e seus nomes. O que não for reconhecido cai em "local". */
const PLATFORM_ROWS: ReadonlyArray<{ key: string; title: string }> = [
  { key: "steam", title: "Steam" },
  { key: "epic", title: "Epic Games" },
  { key: "gog", title: "GOG" },
  { key: "ea", title: "EA App" },
  { key: "ubisoft", title: "Ubisoft" },
  { key: "xbox", title: "Xbox" },
  { key: "battlenet", title: "Battle.net" },
  { key: "riot", title: "Riot Games" },
  { key: "rockstar", title: "Rockstar" },
  { key: "local", title: "Executáveis locais" },
];

const KNOWN_PLATFORMS = new Set(PLATFORM_ROWS.map((p) => p.key));

/** Loja de origem do jogo, normalizada para uma das chaves de PLATFORM_ROWS. */
export function platformKey(game: Pick<Game, "launcherType" | "source">): string {
  const raw = (game.launcherType || game.source || "").toLowerCase();
  return KNOWN_PLATFORMS.has(raw) ? raw : "local";
}

/** Nome legível da loja do jogo ("Steam", "Executáveis locais"...). */
export function platformLabel(game: Pick<Game, "launcherType" | "source">): string {
  const key = platformKey(game);
  if (key === "local") return "Local";
  return PLATFORM_ROWS.find((p) => p.key === key)?.title ?? "Local";
}

/**
 * A fileira única da Home (como na tela inicial de um console): na aba "Todos", os jogos
 * jogados recentemente vêm primeiro, na ordem de "Continuar jogando", e depois o resto da
 * biblioteca na ordem de sempre; em qualquer outra aba, o recorte daquela aba como está.
 * Só entram jogos de `displayGames`, para a busca e os filtros valerem. Sem jogos, nenhuma fileira.
 */
export function buildConsoleRow(
  displayGames: readonly Game[],
  continuePlaying: readonly Game[],
  options: { isAllCategory: boolean; title: string },
): WallRow[] {
  if (displayGames.length === 0) return [];
  if (!options.isAllCategory) return [{ id: "library", title: options.title, games: [...displayGames] }];

  const visible = new Set(displayGames.map((g) => g.id));
  const recent = continuePlaying.filter((g) => visible.has(g.id));
  const recentIds = new Set(recent.map((g) => g.id));
  const rest = displayGames.filter((g) => !recentIds.has(g.id));
  return [{ id: "library", title: options.title, games: [...recent, ...rest] }];
}

/**
 * Onde está o foco: na fileira ativa, se o jogo selecionado está nela; senão na primeira
 * fileira que o contém (o mesmo jogo pode estar em "Continuar" e em "Steam"). Sem jogo
 * selecionado, o início da fileira ativa.
 */
export function resolveWallFocus(
  rows: readonly WallRow[],
  activeRow: number,
  gameId: string | undefined,
): WallFocus {
  if (rows.length === 0) return { row: 0, col: 0 };
  const row = Math.min(Math.max(activeRow, 0), rows.length - 1);
  if (gameId) {
    const colInActive = rows[row].games.findIndex((g) => g.id === gameId);
    if (colInActive !== -1) return { row, col: colInActive };
    for (let r = 0; r < rows.length; r += 1) {
      const col = rows[r].games.findIndex((g) => g.id === gameId);
      if (col !== -1) return { row: r, col };
    }
  }
  return { row, col: 0 };
}

/** Próximo jogo na mesma fileira (esquerda/direita), ou null na borda. */
export function stepColumn(rows: readonly WallRow[], focus: WallFocus, delta: number): Game | null {
  const games = rows[focus.row]?.games;
  if (!games) return null;
  const col = focus.col + delta;
  return col >= 0 && col < games.length ? games[col] : null;
}

/**
 * Troca de fileira (cima/baixo) mantendo a coluna quando dá; numa fileira mais curta,
 * o último pôster. Null na borda.
 */
export function stepRow(
  rows: readonly WallRow[],
  focus: WallFocus,
  delta: number,
): { row: number; game: Game } | null {
  const row = focus.row + delta;
  const games = rows[row]?.games;
  if (!games || games.length === 0) return null;
  return { row, game: games[Math.min(focus.col, games.length - 1)] };
}
