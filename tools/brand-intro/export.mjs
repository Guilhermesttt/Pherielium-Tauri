/**
 * Exporta a intro quadro a quadro: 420 PNGs (7 s × 60 fps, 1920×1080) e, se o
 * `ffmpeg` estiver no PATH, um intro.mp4 (H.264, yuv420p).
 *
 * Uso (na raiz do repo):
 *   node tools/brand-intro/export.mjs                  # tema colorido
 *   node tools/brand-intro/export.mjs --theme=mono     # tema cinza
 *   node tools/brand-intro/export.mjs --out=D:/saida   # pasta de saída
 *
 * Cada quadro é desenhado por `window.renderAt(t)` com t = i / 60, sem depender
 * do relógio, então a gravação não perde quadros mesmo que a máquina seja lenta.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const FPS = 60;
const DURATION = 7;
const FRAMES = FPS * DURATION;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);
const theme = args.theme === "mono" ? "mono" : "color";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(args.out ?? path.join(here, "out", theme));
mkdirSync(outDir, { recursive: true });

const pageUrl = `${pathToFileURL(path.join(here, "index.html")).href}?theme=${theme}&t=0`;

/** Chromium do Playwright se existir; senão o Edge/Chrome já instalados no sistema. */
async function launchBrowser() {
  const failures = [];
  for (const options of [{}, { channel: "msedge" }, { channel: "chrome" }]) {
    try {
      return await chromium.launch(options);
    } catch (err) {
      failures.push(`${options.channel ?? "chromium"}: ${err.message.split("\n")[0]}`);
    }
  }
  throw new Error(`Nenhum navegador disponível. Rode "npx playwright install chromium".\n${failures.join("\n")}`);
}

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pageUrl);
  // O modo ?t= desenha um quadro e para o loop do p5, então nada sobrescreve os quadros abaixo.
  await page.waitForFunction(() => window.__introReady === true, null, { timeout: 30_000 });
  await page.waitForTimeout(300);

  for (let i = 0; i < FRAMES; i++) {
    const dataUrl = await page.evaluate((t) => {
      window.renderAt(t);
      return document.querySelector("canvas").toDataURL("image/png");
    }, i / FPS);
    const png = Buffer.from(dataUrl.split(",")[1], "base64");
    writeFileSync(path.join(outDir, `frame_${String(i).padStart(4, "0")}.png`), png);
    if (i % 60 === 0) console.log(`quadro ${i}/${FRAMES}`);
  }
  console.log(`${FRAMES} quadros gravados em ${outDir}`);
} finally {
  await browser.close();
}

const ffmpegArgs = [
  "-y",
  "-framerate", String(FPS),
  "-i", path.join(outDir, "frame_%04d.png"),
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-crf", "14",
  "-movflags", "+faststart",
  path.join(outDir, "intro.mp4"),
];

if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0) {
  const result = spawnSync("ffmpeg", ffmpegArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error("ffmpeg falhou; os PNGs continuam disponíveis.");
    process.exitCode = 1;
  } else {
    console.log(`Vídeo: ${path.join(outDir, "intro.mp4")}`);
  }
} else {
  console.log("ffmpeg não encontrado no PATH. Para gerar o vídeo depois de instalá-lo, rode:");
  console.log(`ffmpeg ${ffmpegArgs.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
}
