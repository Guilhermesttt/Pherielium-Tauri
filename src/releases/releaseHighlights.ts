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
  version: "1.0.3-rc.6",
  title: "Pherielium 1.0.3 (versão de teste)",
  description:
    "Chamadas que se recuperam sozinhas, transmissão com qualidade à sua escolha e convites como notificação.",
  releaseUrl: "https://github.com/Guilhermesttt/Pherielium-Tauri/releases",
  highlights: [
    {
      id: "voice",
      title: "Chamadas que se recuperam",
      description:
        "Se a internet cair no meio da chamada, o app avisa que está reconectando e volta para a sala sozinho. Cada participante mostra um aviso quando a conexão dele está ruim.",
    },
    {
      id: "stability",
      title: "Transmissão do seu jeito",
      description:
        "Escolha a qualidade (720p, 1080p ou Fonte, até 4K), os 30 ou 60 quadros e o bitrate. O áudio do PC sai sem a voz da chamada voltar em eco, e o volume obedece de 0 a 100%.",
    },
    {
      id: "ui",
      title: "Quem está assistindo",
      description:
        "Quem transmite vê quantas pessoas estão assistindo à tela.",
    },
    {
      id: "security",
      title: "Convites como notificação",
      description:
        "Ligar ou convidar para uma sala chega como convite, com notificação no notch e no jogo, em vez de tocar como ligação. O convite vale por 15 minutos.",
    },
  ],
};

const releasesByVersion = new Map([
  [LATEST_RELEASE.version, LATEST_RELEASE],
]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? LATEST_RELEASE;
