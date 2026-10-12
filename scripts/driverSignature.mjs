// Verificação de assinatura digital (Authenticode) dos instaladores de driver baixados por fetch-drivers.mjs.
//
// Usa o PowerShell que já vem no Windows (Get-AuthenticodeSignature): nenhuma dependência nova.
// Camada extra ao SHA-256 fixado: o hash prova "é o arquivo que foi revisado"; a assinatura prova "quem o publicou".
import { execFile } from "node:child_process";

/** CN do sujeito do certificado ("CN=Fulano, O=..." -> "Fulano"). */
export function commonNameOf(subject) {
  const match = /(?:^|,\s*)CN=("([^"]*)"|[^,]*)/.exec(String(subject ?? ""));
  if (!match) return "";
  return (match[2] ?? match[1]).trim();
}

/**
 * Decisão pura. `info` = { Status, Subject } como devolvido pelo PowerShell.
 * Só aceita assinatura `Valid` cujo CN é exatamente o editor esperado.
 */
export function evaluateSignature(info, expectedSigner) {
  if (!info || typeof info.Status !== "string") {
    return { ok: false, reason: "não foi possível ler a assinatura" };
  }
  if (info.Status !== "Valid") {
    return { ok: false, reason: `assinatura não é válida (status: ${info.Status})` };
  }
  const signer = commonNameOf(info.Subject);
  if (signer !== expectedSigner) {
    return { ok: false, reason: `assinado por "${signer || "?"}", esperado "${expectedSigner}"` };
  }
  return { ok: true, reason: `assinatura válida de ${signer}` };
}

const POWERSHELL_SCRIPT =
  "$s = Get-AuthenticodeSignature -LiteralPath $env:DRIVER_FILE; " +
  "ConvertTo-Json -Compress @{ Status = $s.Status.ToString(); Subject = [string]$s.SignerCertificate.Subject }";

function runPowerShell(file) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", POWERSHELL_SCRIPT],
      { env: { ...process.env, DRIVER_FILE: file }, windowsHide: true, timeout: 60_000 },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });
}

/**
 * Verifica a assinatura de `file`.
 * - Windows: executa o PowerShell e decide com `evaluateSignature`. Qualquer falha ao verificar conta como NÃO verificado.
 * - Outros sistemas: não há como verificar Authenticode aqui; devolve `{ skipped: true }` (o SHA-256 continua valendo).
 *   Com DRIVERS_REQUIRE_SIGNATURE=1 isso vira falha, para CI que deva garantir a verificação.
 */
export async function verifyDriverSignature(file, expectedSigner, { platform = process.platform, run = runPowerShell, env = process.env } = {}) {
  if (platform !== "win32") {
    if (env.DRIVERS_REQUIRE_SIGNATURE === "1") {
      return { ok: false, skipped: false, reason: "verificação de assinatura exige Windows (DRIVERS_REQUIRE_SIGNATURE=1)" };
    }
    return { ok: true, skipped: true, reason: "assinatura NÃO verificada (só há verificação no Windows; SHA-256 confere)" };
  }
  try {
    const info = JSON.parse(await run(file));
    return { skipped: false, ...evaluateSignature(info, expectedSigner) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, skipped: false, reason: `falha ao verificar a assinatura: ${message}` };
  }
}
