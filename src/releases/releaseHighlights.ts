export interface ReleaseHighlight {
  id: "controller" | "stability" | "platforms" | "search" | "mods" | "voice" | "ui" | "security";
  title: string;
  description: string;
}

export interface ReleaseHighlights {
  version: string;
  title: string;
  description: string;
  releaseUrl: string;
  highlights: ReleaseHighlight[];
}

export const LATEST_RELEASE: ReleaseHighlights = {
  version: "1.0.0",
  title: "Pherielium 1.0",
  description:
    "Primeira versão estável no GitHub: setup com ícone novo, tela de configuração inicial e atualizações pelo repositório.",
  releaseUrl: "https://github.com/Guilhermesttt/Pherielium-Tauri/releases/tag/v1.0.0",
  highlights: [
    {
      id: "ui",
      title: "Configuração inicial",
      description:
        "Wizard de first-run com o ícone do hub e preferências de janela (bandeja, confirmar saída, iniciar com o Windows).",
    },
    {
      id: "stability",
      title: "Atualizações pelo GitHub",
      description:
        "O launcher verifica releases novas e mostra uma notificação fixa para você atualizar.",
    },
    {
      id: "security",
      title: "Identidade 1.0",
      description:
        "Ícone e instalador alinhados à marca Pherielium neste repositório.",
    },
  ],
};

const releasesByVersion = new Map([
  [LATEST_RELEASE.version, LATEST_RELEASE],
]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? LATEST_RELEASE;
