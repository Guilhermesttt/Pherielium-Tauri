/**
 * Migração do visual "Pherielium Refined" (branch design/hub-refined).
 *
 * Troca valores escritos à mão nas classes Tailwind pelos tokens do sistema (src/index.css):
 *   - text-white/NN            -> var(--ink) | var(--ink-muted) | var(--ink-faint)  (pela opacidade)
 *   - text-[10px..36px]        -> text-[length:var(--step-N)]  (piso de 13px; 9px ou menos fica: contadores)
 *   - bg-[#cinza]              -> bg-[var(--tone-N)]           (pela luminância; mantém o /opacidade)
 *   - text-[#cinza claro]      -> var(--ink*)  ;  text-[#cinza escuro] -> var(--tone-0)
 *
 * Por que um script: são ~3.000 ocorrências em ~250 arquivos; à mão erraria e não daria para revisar.
 * Idempotente (rodar de novo não muda nada). Fica de fora o que não faz parte do hub
 * (overlay do jogo, notch, mascote, módulo de controle e a landing do site).
 *
 * Uso: node scripts/migrate-refined-tokens.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const DRY = process.argv.includes("--dry");

const EXCLUDED = ["overlay", "mascot", join("components", "notch"), join("components", "controller"), join("components", "landing"), "Landing.tsx"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(SRC, full);
    if (EXCLUDED.some((e) => rel === e || rel.startsWith(e + sep))) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Opacidade de texto branco -> tinta. >= 80% lê como texto principal; >= 50% como secundário; abaixo, nota. */
function inkFor(alpha) {
  if (alpha >= 0.8) return "var(--ink)";
  if (alpha >= 0.5) return "var(--ink-muted)";
  return "var(--ink-faint)";
}

/** Tamanho em px -> passo da escala (13, 15, 17, 22, 32). */
function stepFor(px) {
  if (px <= 13) return "--step-0";
  if (px <= 16) return "--step-1";
  if (px <= 19) return "--step-2";
  if (px <= 26) return "--step-3";
  return "--step-4";
}

function neutral(hex) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return Math.max(r, g, b) - Math.min(r, g, b) <= 12 ? (r + g + b) / 3 : null;
}

/** Cinza de fundo -> degrau de tom (#050505, #0e0e10, #17171a, #212125, #2c2c31). Claros ficam (botões brancos). */
function toneFor(lum) {
  if (lum < 9) return "var(--tone-0)";
  if (lum < 19) return "var(--tone-1)";
  if (lum < 29) return "var(--tone-2)";
  if (lum < 39) return "var(--tone-3)";
  if (lum < 60) return "var(--tone-4)";
  return null;
}

function textNeutralFor(lum) {
  if (lum >= 235) return "var(--ink)";
  if (lum >= 150) return "var(--ink-muted)";
  if (lum >= 90) return "var(--ink-faint)";
  if (lum < 20) return "var(--tone-0)";
  return null;
}

// Só dentro de classes (precedido de início, espaço, aspas, crase ou ":" de variante).
const B = "(?<=^|[\\s\"'`:])";

export function migrate(source) {
  let s = source;
  s = s.replace(new RegExp(`${B}text-white\\/(\\d{1,3}|\\[(0?\\.\\d+)\\])(?![\\w\\[/.-])`, "g"), (m, n, frac) => {
    const alpha = frac !== undefined ? Number(frac) : Number(n) / 100;
    return `text-[${inkFor(alpha)}]`;
  });
  s = s.replace(new RegExp(`${B}text-\\[(\\d{1,2}(?:\\.\\d+)?)px\\]`, "g"), (m, n) => {
    const px = Number(n);
    if (px < 10 || px > 40) return m;
    return `text-[length:var(${stepFor(px)})]`;
  });
  s = s.replace(new RegExp(`${B}bg-\\[#([0-9a-fA-F]{6})\\]`, "g"), (m, hex) => {
    const lum = neutral(hex);
    const tone = lum === null ? null : toneFor(lum);
    return tone ? `bg-[${tone}]` : m;
  });
  s = s.replace(new RegExp(`${B}text-\\[#([0-9a-fA-F]{6})\\]`, "g"), (m, hex) => {
    const lum = neutral(hex);
    const ink = lum === null ? null : textNeutralFor(lum);
    return ink ? `text-[${ink}]` : m;
  });
  return s;
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  let files = 0;
  for (const file of walk(SRC)) {
    const before = readFileSync(file, "utf8");
    const after = migrate(before);
    if (after !== before) {
      files += 1;
      if (!DRY) writeFileSync(file, after, "utf8");
    }
  }
  console.log(`${DRY ? "[dry] " : ""}${files} arquivos ${DRY ? "seriam alterados" : "alterados"}`);
}
