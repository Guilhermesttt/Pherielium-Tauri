// Baixa os instaladores dos drivers de controle para src-tauri/windows/drivers/.
//
// Os .exe NAO ficam no git (~14 MB, binarios de terceiros). Versao e SHA-256
// ficam fixados em drivers.manifest.json: se o arquivo baixado nao bater, o
// script falha e remove o arquivo — um instalador de driver de kernel nunca
// entra no pacote sem ser exatamente o que foi revisado.
//
// Uso: npm run drivers:fetch
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { verifyDriverSignature } from "./driverSignature.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, "drivers.manifest.json"), "utf8"));
const outDir = resolve(here, "..", "src-tauri", "windows", "drivers");
mkdirSync(outDir, { recursive: true });

const sha256Of = async (path) =>
  createHash("sha256").update(await readFile(path)).digest("hex");

// Camada extra ao hash: o instalador precisa estar assinado (Authenticode) pelo editor esperado do manifesto.
// Falha de forma segura: assinatura inválida ou impossível de verificar no Windows remove o arquivo e reprova.
// Fora do Windows não há como verificar: avisa e segue (DRIVERS_REQUIRE_SIGNATURE=1 transforma isso em erro).
const checkSignature = async (driver, target) => {
  const result = await verifyDriverSignature(target, driver.signer);
  if (!result.ok) {
    rmSync(target, { force: true });
    console.error(`ERRO   ${driver.name}: ${result.reason}. arquivo removido.`);
    return false;
  }
  console.log(`${result.skipped ? "aviso " : "ok    "} ${driver.name}: ${result.reason}`);
  return true;
};

let failed = false;
for (const driver of manifest.drivers) {
  const target = join(outDir, driver.file);

  if (existsSync(target) && (await sha256Of(target)) === driver.sha256) {
    console.log(`ok     ${driver.name} ${driver.version} (ja baixado, sha256 confere)`);
    if (!(await checkSignature(driver, target))) failed = true;
    continue;
  }

  console.log(`baixa  ${driver.name} ${driver.version}`);
  const response = await fetch(driver.url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    console.error(`ERRO   ${driver.name}: HTTP ${response.status}`);
    failed = true;
    continue;
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));

  const actual = await sha256Of(target);
  if (actual !== driver.sha256) {
    rmSync(target, { force: true });
    console.error(
      `ERRO   ${driver.name}: SHA-256 nao confere.\n       esperado ${driver.sha256}\n       obtido   ${actual}\n       arquivo removido.`,
    );
    failed = true;
    continue;
  }
  console.log(`ok     ${driver.name} ${driver.version} (sha256 confere)`);
  if (!(await checkSignature(driver, target))) failed = true;
}

process.exit(failed ? 1 : 0);
