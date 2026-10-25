import { describe, expect, it } from "vitest";
import type { NexusModFile } from "./nexus";
import { formatFileSize, groupNexusFiles } from "./nexusFiles";

let seq = 0;
const file = (over: Partial<NexusModFile>): NexusModFile => ({
  id: String(++seq),
  name: "Conflict Begone",
  version: "1.0.0",
  category: "MAIN",
  description: "",
  sizeKb: 21,
  uploadedAt: 1000,
  primary: false,
  ...over,
});

describe("groupNexusFiles", () => {
  it("usa o arquivo marcado como principal pela Nexus", () => {
    const primary = file({ version: "1.2.4", primary: true, uploadedAt: 500 });
    const groups = groupNexusFiles([file({ uploadedAt: 900 }), primary]);
    expect(groups.main).toBe(primary);
  });

  it("sem marcação, usa o MAIN mais recente e ignora OLD_VERSION", () => {
    const newest = file({ version: "1.2.4", uploadedAt: 3000 });
    const groups = groupNexusFiles([
      file({ version: "1.0.1", category: "OLD_VERSION", uploadedAt: 9000 }),
      file({ version: "1.2.0", uploadedAt: 2000 }),
      newest,
    ]);
    expect(groups.main).toBe(newest);
  });

  it("separa versões antigas e opcionais do principal", () => {
    const main = file({ primary: true });
    const optional = file({ category: "OPTIONAL", name: "Patch extra", uploadedAt: 10 });
    const old1 = file({ category: "OLD_VERSION", uploadedAt: 1 });
    const old2 = file({ category: "OLD_VERSION", uploadedAt: 2 });
    const groups = groupNexusFiles([old1, optional, main, old2]);
    expect(groups.main).toBe(main);
    expect(groups.optional).toEqual([optional]);
    expect(groups.old).toEqual([old2, old1]);
  });

  it("um OPTIONAL mais novo nunca vira o principal quando existe MAIN", () => {
    const main = file({ category: "MAIN", uploadedAt: 100 });
    const optional = file({ category: "OPTIONAL", uploadedAt: 999 });
    expect(groupNexusFiles([optional, main]).main).toBe(main);
  });

  it("se só sobraram versões antigas, o mais novo delas é o principal e não se repete", () => {
    const a = file({ category: "OLD_VERSION", uploadedAt: 1 });
    const b = file({ category: "OLD_VERSION", uploadedAt: 2 });
    const groups = groupNexusFiles([a, b]);
    expect(groups.main).toBe(b);
    expect(groups.old).toEqual([a]);
  });

  it("lista vazia não quebra", () => {
    expect(groupNexusFiles([])).toEqual({ main: null, optional: [], old: [] });
  });
});

describe("formatFileSize", () => {
  it("formata KB e MB", () => {
    expect(formatFileSize(21)).toBe("21 KB");
    expect(formatFileSize(1536)).toBe("1,5 MB");
    expect(formatFileSize(0)).toBe("");
  });
});
