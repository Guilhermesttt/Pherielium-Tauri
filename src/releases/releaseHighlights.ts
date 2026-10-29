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

const RELEASE_1_0_3: ReleaseHighlights = {
  version: "1.0.3",
  title: "Pherielium 1.0.3",
  description:
    "Um visual novo para o hub inteiro, chamadas que se recuperam sozinhas, transmissão com qualidade à sua escolha e convites como notificação.",
  releaseUrl: "https://github.com/Guilhermesttt/Pherielium-Tauri/releases",
  highlights: [
    {
      id: "ui",
      title: "Visual novo",
      description:
        "O hub inteiro foi redesenhado: superfícies limpas, botões em pílula, texto mais legível (nada abaixo de 13px) e movimento suave. Troféus, Mods e Configurações ganharam telas novas.",
    },
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
        "Escolha a qualidade (720p, 1080p ou Fonte, até 4K), os 30 ou 60 quadros e o bitrate, e veja quantas pessoas estão assistindo. O áudio do PC sai sem a voz da chamada voltar em eco.",
    },
    {
      id: "security",
      title: "Convites e segurança",
      description:
        "Ligar ou convidar para uma sala chega como convite, com notificação no notch e no jogo. E o app agora pede ao Windows só as permissões que de fato usa.",
    },
  ],
};

export const LATEST_RELEASE: ReleaseHighlights = {
  version: "1.0.4",
  title: "Pherielium 1.0.4",
  description:
    "Amigos, Troféus e Perfil redesenhados, downloads de mods que pausam e retomam, foto e banner que você enquadra arrastando, e animações quando um jogo chega à biblioteca.",
  releaseUrl: "https://github.com/Guilhermesttt/Pherielium-Tauri/releases",
  highlights: [
    {
      id: "ui",
      title: "Interface renovada",
      description:
        "Botões e abas preenchidos, com um bloco que desliza até a aba escolhida. Amigos, Troféus, Perfil, chamadas e salas de voz ganharam telas novas, e rank e nível aparecem juntos.",
    },
    {
      id: "mods",
      title: "Mods mais fáceis",
      description:
        "Pause, retome ou cancele downloads, siga o passo a passo da conta gratuita do Nexus e veja um aviso quando um mod precisa de outro que não está instalado.",
    },
    {
      id: "platforms",
      title: "Biblioteca que reage",
      description:
        "O filtro personalizado atualiza na hora, e os jogos novos entram com animação, uma para quando você adiciona e outra para quando sincroniza.",
    },
    {
      id: "stability",
      title: "Conquistas contadas",
      description:
        "Conquistas de Steam e Epic somam troféu e XP assim que são desbloqueadas, mesmo com a tela do jogo fechada.",
    },
  ],
};

const releasesByVersion = new Map([
  [RELEASE_1_0_3.version, RELEASE_1_0_3],
  [LATEST_RELEASE.version, LATEST_RELEASE],
]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? LATEST_RELEASE;
