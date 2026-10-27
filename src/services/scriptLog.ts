/** Um erro do compilador de scripts (REDscript) lido do log do jogo. */
export interface ScriptError {
  code: string;
  /** Pasta do mod em `r6/scripts`. */
  modFolder: string;
  file: string;
  line: number;
  snippet: string;
  message: string;
  /** Nome que o código usa e não existe, por exemplo `ModSettings`. */
  missingSymbol: string | null;
}

export interface ScriptLogReport {
  logFound: boolean;
  logPath: string | null;
  /** Quando o jogo gravou o log (ms desde 1970). */
  writtenAt: number | null;
  errors: ScriptError[];
}

/** Mods base que outros mods exigem: o nome que o log mostra → como se chama no Nexus. */
const KNOWN_REQUIREMENTS: Record<string, string> = {
  ModSettings: "Mod Settings",
  Codeware: "Codeware",
  ArchiveXL: "ArchiveXL",
  TweakXL: "TweakXL",
  NativeSettings: "Native Settings UI",
  RED4ext: "RED4ext",
  InkPlayground: "Ink Playground",
};

export interface ScriptIssue {
  /** Pasta do mod que falhou ao compilar. */
  modFolder: string;
  /** Texto pronto para a tela. */
  summary: string;
  /** Nome do mod que falta, quando o log deixa dizer. */
  requirement: string | null;
  /** Primeira mensagem do compilador, para quem quiser o detalhe. */
  detail: string;
}

/** Procura o mod que falta no Nexus (a busca do jogo, já que o log só traz o nome do código). */
export function requirementSearchUrl(gameDomain: string, requirement: string): string {
  const query = encodeURIComponent(requirement);
  return `https://www.nexusmods.com/${encodeURIComponent(gameDomain)}/search/?gsearch=${query}&gsearchtype=mods`;
}

/** Um aviso por mod com erro, juntando as linhas que falham pelo mesmo motivo. */
export function describeScriptIssues(errors: readonly ScriptError[]): ScriptIssue[] {
  const byMod = new Map<string, ScriptError[]>();
  for (const error of errors) {
    byMod.set(error.modFolder, [...(byMod.get(error.modFolder) ?? []), error]);
  }
  return [...byMod.entries()].map(([modFolder, list]) => {
    const symbol = list.find((error) => error.missingSymbol)?.missingSymbol ?? null;
    const requirement = symbol ? (KNOWN_REQUIREMENTS[symbol] ?? symbol) : null;
    const summary = requirement
      ? `${modFolder} precisa do mod "${requirement}", que não está instalado.`
      : `${modFolder} tem um erro de script: ${list[0].message}`;
    return { modFolder, summary, requirement, detail: list[0].message };
  });
}
