export interface AntiCheatGameInfo {
  title: string;
  antiCheatEngine: string;
  warningNotice: string;
}

/**
 * Mapeamento de jogos conhecidos por utilizarem Anti-Cheat competitivo.
 * Modificar executáveis ou injetar DLLs nesses jogos pode resultar em banimento permanente.
 */
export const ANTI_CHEAT_GAMES_MAP: Record<string, AntiCheatGameInfo> = {
  // Steam AppIDs
  "730": {
    title: "Counter-Strike 2",
    antiCheatEngine: "VAC / Trusted Mode",
    warningNotice: "CS2 utiliza Valve Anti-Cheat. Modificações ou injeções de código no modo protegido podem banir sua conta Steam.",
  },
  "570": {
    title: "Dota 2",
    antiCheatEngine: "VAC",
    warningNotice: "Dota 2 utiliza Valve Anti-Cheat. Tenha cuidado ao instalar modificações em partidas ranqueadas.",
  },
  "1086940": {
    title: "Baldur's Gate 3",
    antiCheatEngine: "Nenhum (Jogo Single/Co-op)",
    warningNotice: "",
  },
  "271590": {
    title: "Grand Theft Auto V",
    antiCheatEngine: "BattlEye / Rockstar Anti-Cheat",
    warningNotice: "GTA V possui anti-cheat no GTA Online. Certifique-se de desativar mods antes de entrar em servidores públicos online.",
  },
  "1938090": {
    title: "Call of Duty: Warzone",
    antiCheatEngine: "RICOCHET Anti-Cheat",
    warningNotice: "Call of Duty possui o sistema RICOCHET a nível de Kernel. Quaisquer arquivos modificados causarão banimento imediato.",
  },
  "1172470": {
    title: "Apex Legends",
    antiCheatEngine: "Easy Anti-Cheat (EAC)",
    warningNotice: "Apex Legends utiliza Easy Anti-Cheat. Mods de código não homologados causam desconexão ou suspensão da conta.",
  },
  "252490": {
    title: "Rust",
    antiCheatEngine: "Easy Anti-Cheat (EAC)",
    warningNotice: "Rust possui Easy Anti-Cheat ativo em todos os servidores oficiais.",
  },
  "381210": {
    title: "Dead by Daylight",
    antiCheatEngine: "Easy Anti-Cheat (EAC)",
    warningNotice: "Dead by Daylight verifica a integridade de todos os arquivos via EAC ao iniciar.",
  },
  // Game domains da Nexus Mods
  "cyberpunk2077": {
    title: "Cyberpunk 2077",
    antiCheatEngine: "Nenhum (Single-player)",
    warningNotice: "",
  },
  "witcher3": {
    title: "The Witcher 3",
    antiCheatEngine: "Nenhum (Single-player)",
    warningNotice: "",
  },
  "skyrimspecialedition": {
    title: "Skyrim Special Edition",
    antiCheatEngine: "Nenhum (Single-player)",
    warningNotice: "",
  },
};

export function getAntiCheatInfo(gameIdOrAppId?: string, gameDomain?: string): AntiCheatGameInfo | null {
  if (gameIdOrAppId && ANTI_CHEAT_GAMES_MAP[gameIdOrAppId]?.warningNotice) {
    return ANTI_CHEAT_GAMES_MAP[gameIdOrAppId];
  }
  if (gameDomain && ANTI_CHEAT_GAMES_MAP[gameDomain.toLowerCase()]?.warningNotice) {
    return ANTI_CHEAT_GAMES_MAP[gameDomain.toLowerCase()];
  }
  return null;
}
