import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("./index.css");
const wheel = read("./components/ui/wheel-carousel.tsx");
const api = read("./lib/tauriAPI.ts");
const social = read("./components/game-detail/GameDetailSocialMods.tsx");
const panel = read("./components/game-detail/GameDetailPanel.tsx");
const rust = read("../src-tauri/src/commands/captures.rs");
const chatModal = read("./components/home/ChatModal.tsx");
const overlay = read("./overlay/OverlayApp.tsx");
const home = read("./pages/Home.tsx");

describe("roda de plataformas", () => {
  it("o quadro agendado é zerado ao desmontar (senão o scroll para de andar depois de uma remontagem)", () => {
    expect(wheel).toMatch(/cancelAnimationFrame\(frameRef\.current\);\s*[^}]*frameRef\.current = null;/);
  });

  it("sem o contorno fino de foco na roda e nos itens (a pílula já mostra o foco)", () => {
    expect(wheel).toContain("wheel-stage");
    expect(wheel).toContain("wheel-item");
    expect(wheel).not.toContain("focus-visible:ring-2");
    expect(css).toMatch(/\.wheel-item:focus-visible,[\s\S]*?\{\s*outline: none;\s*box-shadow: none;/);
  });
});

describe("aba Capturas e mural de fotos", () => {
  it("as capturas do jogo vêm da pasta de capturas, filtradas pelo título", () => {
    expect(api).not.toContain("getLocalGameScreenshots: (_request: unknown) => Promise.resolve([])");
    expect(api).toMatch(/getLocalGameScreenshots: async[\s\S]*?listRecentCaptures\(60, 1280, title\)/);
    expect(rust).toMatch(/pub fn list_recent_captures\(\s*limit: Option<u32>,\s*thumb_width: Option<u32>,\s*game_title: Option<String>/);
    expect(rust).toContain("safe_folder_name(title).to_lowercase()");
  });

  it("a aba Sobre mostra o mural com as imagens da loja, na mesma grade das capturas", () => {
    expect(social).toContain("const PhotoWall");
    expect(social).toMatch(/storeScreenshots\.length > 0 &&[\s\S]*?<PhotoWall items=\{storeScreenshots\}/);
    expect(social).toMatch(/<PhotoWall\s+items=\{localScreenshots\.map/);
    // as imagens locais ficam de fora do mural da loja e mantêm a posição na galeria
    expect(panel).toMatch(/item\.id\.startsWith\("local-"\)/);
    expect(panel).toContain("storeScreenshots={storeScreenshots}");
  });
});

describe("esqueleto das conversas", () => {
  it("o modal de mensagens do hub mostra o esqueleto (não mais o spinner) enquanto carrega", () => {
    expect(chatModal).toMatch(/isLoading \? \(\s*<ChatSkeleton/);
    expect(chatModal).not.toContain('label="Carregando conversa..."');
  });

  it("o overlay recebe o estado de carregamento da conversa e mostra o esqueleto até chegar a 1ª leva", () => {
    expect(home).toMatch(/setOverlayChatLoading\(true\)/);
    expect(home).toMatch(/loading: overlayChatLoading/);
    expect(home).toMatch(/window\.setTimeout\(\(\) => setOverlayChatLoading\(false\), 8000\)/);
    expect(overlay).toMatch(/panelData\.chat\.loading && panelData\.chat\.messages\.length === 0 \?\s*\(\s*<ChatSkeleton/);
  });

  it("os balões pulsam e param com reduzir movimento", () => {
    expect(css).toMatch(/\.chat-skel-bubble \{[\s\S]*?animation: chat-skel-pulse/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.chat-skel-bubble \{ animation: none; \}/);
  });
});
