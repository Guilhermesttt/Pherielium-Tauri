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
  version: "1.0.2",
  title: "Pherielium 1.0.2",
  description:
    "Controle completo nas Ajustes, legendas de gamepad em todas as páginas, Home mais fluida e uma Pherie com voz.",
  releaseUrl: "https://github.com/Guilhermesttt/Pherielium-Tauri/releases/tag/v1.0.2",
  highlights: [
    {
      id: "controller",
      title: "Controle completo nas Ajustes",
      description:
        "Nova aba Controles com visualizador ao vivo, bateria, teste de vibração, drift e circularidade dos sticks, e perfis com zona morta e curvas de resposta (global ou por jogo).",
    },
    {
      id: "ui",
      title: "Legendas do controle em todo lugar",
      description:
        "Home, Amigos, Ajustes e as demais páginas mostram os comandos do gamepad no rodapé. O hero da Home ficou mais limpo, sem os botões Jogar Agora e Detalhes.",
    },
    {
      id: "stability",
      title: "Mais fluido, sem engasgos",
      description:
        "O vídeo de fundo congela enquanto você navega e sai de cena sozinho em PCs mais fracos. O analógico direito rola Mods e Troféus direito, e o controle fica travado durante a animação de lançamento.",
    },
    {
      id: "voice",
      title: "Pherie com voz e notch em chamada",
      description:
        "A Pherie ganhou gorjeios fofos para susto, sono, alegria e cutucadas. Em chamada, o notch expandido mostra as abas (inclusive Controle) e some quando outra janela está em foco.",
    },
  ],
};

const releasesByVersion = new Map([
  [LATEST_RELEASE.version, LATEST_RELEASE],
]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? LATEST_RELEASE;
