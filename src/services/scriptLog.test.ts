import { describe, expect, it } from "vitest";
import { describeScriptIssues, requirementSearchUrl, type ScriptError } from "./scriptLog";

const error = (over: Partial<ScriptError>): ScriptError => ({
  code: "UNRESOLVED_REF",
  modFolder: "INCF-CORE",
  file: "INCF-CORE/INCF-CORE.reds",
  line: 134,
  snippet: "ModSettings.RegisterListenerToClass(this);",
  message: "unresolved reference 'ModSettings'",
  missingSymbol: "ModSettings",
  ...over,
});

describe("describeScriptIssues", () => {
  it("diz qual mod falta quando o log aponta um nome desconhecido ao código", () => {
    const [issue] = describeScriptIssues([error({})]);
    expect(issue.requirement).toBe("Mod Settings");
    expect(issue.summary).toBe('INCF-CORE precisa do mod "Mod Settings", que não está instalado.');
  });

  it("junta vários erros do mesmo mod em um aviso só", () => {
    const issues = describeScriptIssues([error({}), error({ line: 140 }), error({ modFolder: "Outro", missingSymbol: "Codeware" })]);
    expect(issues.map((issue) => issue.modFolder)).toEqual(["INCF-CORE", "Outro"]);
  });

  it("um nome fora da tabela é mostrado como está", () => {
    const [issue] = describeScriptIssues([error({ missingSymbol: "FooLib" })]);
    expect(issue.requirement).toBe("FooLib");
  });

  it("um erro sem mod faltando mostra a mensagem do compilador", () => {
    const [issue] = describeScriptIssues([error({ code: "SYNTAX_ERR", message: "expected an expression", missingSymbol: null })]);
    expect(issue.requirement).toBeNull();
    expect(issue.summary).toContain("expected an expression");
  });

  it("sem erros, sem avisos", () => {
    expect(describeScriptIssues([])).toEqual([]);
  });
});

describe("requirementSearchUrl", () => {
  it("monta a busca do jogo com o nome codificado", () => {
    expect(requirementSearchUrl("cyberpunk2077", "Mod Settings")).toBe(
      "https://www.nexusmods.com/cyberpunk2077/search/?gsearch=Mod%20Settings&gsearchtype=mods",
    );
  });
});
