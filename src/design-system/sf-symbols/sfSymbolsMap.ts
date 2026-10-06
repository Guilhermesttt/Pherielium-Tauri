import type { SfSymbolName } from "./types";

// Vite eager glob imports all symbol PNGs as resolved asset URLs
const symbolModules = import.meta.glob<string>(
  "../../assets/sf-symbols/*.png",
  { eager: true, import: "default" }
);

const symbolMap: Partial<Record<SfSymbolName, string>> = {};

for (const [filePath, url] of Object.entries(symbolModules)) {
  const match = filePath.match(/\/([^/]+)\.png$/);
  if (match && match[1]) {
    symbolMap[match[1] as SfSymbolName] = url;
  }
}

export function getSfSymbolUrl(name: SfSymbolName): string | undefined {
  return symbolMap[name];
}

export function getSfSymbolFillVariant(name: SfSymbolName): SfSymbolName | undefined {
  if (name.endsWith(".fill")) return name;
  const fillName = `${name}.fill` as SfSymbolName;
  return symbolMap[fillName] ? fillName : undefined;
}

export { symbolMap };
