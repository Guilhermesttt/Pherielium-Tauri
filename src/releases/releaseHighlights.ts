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
  version: "3.2.7",
  title: "Confirmações claras & novo ícone",
  description:
    "Modais de confirmação com ícones animados por contexto, Whats New redesenhado e o novo ícone do Pherielium na área de trabalho e no instalador.",
  releaseUrl: "https://github.com/Guilhermesttt/Pherielium-Hub/releases/tag/v3.2.7",
  highlights: [
    {
      id: "ui",
      title: "Mensagens de confirmação claras",
      description:
        "Ícones animados para remover jogo, sair da conta, desfazer amizade e desconectar plataformas — intenção óbvia antes de confirmar.",
    },
    {
      id: "stability",
      title: "Novo ícone do hub",
      description:
        "Identidade visual atualizada no atalho da área de trabalho, na janela do app e no instalador Windows.",
    },
    {
      id: "voice",
      title: "Polimento da experiência social",
      description:
        "Ajustes de voz, chat e fluxo de amigos para uma navegação mais fluida no dia a dia.",
    },
  ],
};

const releasesByVersion = new Map([
  [LATEST_RELEASE.version, LATEST_RELEASE],
  ["3.2.6", LATEST_RELEASE],
  ["3.2.5", LATEST_RELEASE],
  ["3.2.4", {
    version: "3.2.4",
    title: "Telemetria de Controle, Voz Ultrarrápida & Galeria In-Game",
    description: "Detecção nativa de bateria e conexão USB/Bluetooth para DualSense, DS4 e Xbox...",
    releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.2.4",
    highlights: [
      { id: "controller", title: "Telemetria & Bateria Precisa", description: "Leitura nativa precisa de bateria..." },
      { id: "voice", title: "Voz com Conexão Instantânea", description: "Conexão ultrarrápida via LiveKit..." },
    ]
  } as ReleaseHighlights],
]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? LATEST_RELEASE;
