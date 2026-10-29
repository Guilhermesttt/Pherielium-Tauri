import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LATEST_RELEASE, getReleaseHighlights } from "./releaseHighlights";

const manifest = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf-8")) as { version: string };

describe("novidades da versão", () => {
  it("a última versão com novidades é a versão do app (package.json e tauri.conf.json)", () => {
    // o modal "O que há de novo" mostrava a 1.0.3 na 1.0.4: esta checagem pega o esquecimento no próximo release
    expect(LATEST_RELEASE.version).toBe(manifest("../../package.json").version);
    expect(manifest("../../src-tauri/tauri.conf.json").version).toBe(LATEST_RELEASE.version);
  });

  it("versões antigas continuam achando as próprias novidades; desconhecida cai na última", () => {
    expect(getReleaseHighlights("1.0.3").version).toBe("1.0.3");
    expect(getReleaseHighlights("9.9.9").version).toBe(LATEST_RELEASE.version);
  });
});
