import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda de menor privilégio para as janelas do Tauri.
 *
 * O frontend não usa os plugins shell nem fs (arquivos e processos passam por comandos Rust
 * próprios, com validação no lado nativo). Dar essas permissões à webview só serviria para
 * transformar uma injeção de script em "executar programa" e "ler/escrever qualquer arquivo".
 * Se um dia o frontend precisar delas, a permissão deve vir com escopo e este teste ser ajustado
 * de propósito.
 */
type Permission = string | { identifier: string };

const readPermissions = (file: string): string[] => {
  const raw = JSON.parse(readFileSync(resolve(__dirname, "../../src-tauri/capabilities", file), "utf8")) as {
    permissions: Permission[];
  };
  return raw.permissions.map((p) => (typeof p === "string" ? p : p.identifier));
};

const FORBIDDEN = /^(shell:|fs:)/;

describe("capacidades do Tauri", () => {
  it.each(["default.json", "overlay.json"])("%s não dá shell nem fs à webview", (file) => {
    expect(readPermissions(file).filter((p) => FORBIDDEN.test(p))).toEqual([]);
  });

  it("o http da janela principal só fala com o backend conhecido", () => {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, "../../src-tauri/capabilities/default.json"), "utf8"),
    ) as { permissions: Array<string | { identifier: string; allow?: Array<{ url: string }> }> };
    const http = raw.permissions.find((p) => typeof p !== "string" && p.identifier === "http:default");
    const urls = typeof http === "object" ? (http.allow ?? []).map((a) => a.url) : [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^(https:\/\/checkpoint-launcher\.onrender\.com|https?:\/\/localhost:8787)\//);
    }
  });
});
