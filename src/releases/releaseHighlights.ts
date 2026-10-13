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
  version: "1.0.3-rc.3",
  title: "Pherielium 1.0.3 (versão de teste)",
  description:
    "Chamadas e transmissão mais confiáveis: volume que obedece, áudio do PC na tela inteira e convites de chamada como notificação.",
  releaseUrl: "https://github.com/Guilhermesttt/Pherielium-Tauri/releases",
  highlights: [
    {
      id: "voice",
      title: "Volume que obedece",
      description:
        "O volume da transmissão e o da voz agora vão de 0 a 100% sem tocar em dobro, também com a câmera ligada, e voltar a saída de áudio para Padrão funciona.",
    },
    {
      id: "stability",
      title: "Áudio do PC na tela inteira",
      description:
        "A transmissão passa a levar o som do computador (todos os apps, menos o Pherielium) sem a voz da chamada voltar em eco. Se o áudio não puder ser capturado, você é avisado.",
    },
    {
      id: "platforms",
      title: "Chamadas sem surpresas",
      description:
        "Até 3 tentativas de conectar e uma mensagem clara quando não der, em vez de cair em silêncio para um modo pior. O convite chega mais rápido.",
    },
    {
      id: "security",
      title: "Convites como notificação (opcional)",
      description:
        "Em teste, desligado por padrão: o convite de chamada aparece no notch e no overlay do jogo, sem tocar como ligação, e vale por 15 minutos.",
    },
  ],
};

const releasesByVersion = new Map([
  [LATEST_RELEASE.version, LATEST_RELEASE],
]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? LATEST_RELEASE;
