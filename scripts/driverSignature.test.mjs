import { describe, expect, it } from "vitest";
import { commonNameOf, evaluateSignature, verifyDriverSignature } from "./driverSignature.mjs";

const SIGNER = "Nefarius Software Solutions e.U.";
const subject = `CN=${SIGNER}, O=${SIGNER}, L=Wels, C=AT`;

describe("commonNameOf", () => {
  it("extracts the CN", () => {
    expect(commonNameOf(subject)).toBe(SIGNER);
    expect(commonNameOf('CN="Quoted, Inc", O=x')).toBe("Quoted, Inc");
    expect(commonNameOf("O=sem cn")).toBe("");
    expect(commonNameOf(undefined)).toBe("");
  });
});

describe("evaluateSignature", () => {
  it.each([
    [{ Status: "Valid", Subject: subject }, true],
    [{ Status: "NotSigned", Subject: "" }, false],
    [{ Status: "HashMismatch", Subject: subject }, false],
    [{ Status: "UnknownError", Subject: subject }, false],
    [{ Status: "Valid", Subject: "CN=Outro Editor, O=x" }, false],
    [{ Status: "Valid", Subject: `CN=${SIGNER} Falso, O=x` }, false], // não basta conter o nome
    [{}, false],
    [null, false],
  ])("%j -> ok=%s", (info, ok) => {
    expect(evaluateSignature(info, SIGNER).ok).toBe(ok);
  });
});

describe("verifyDriverSignature", () => {
  it("accepts a valid signature on Windows", async () => {
    const run = async () => JSON.stringify({ Status: "Valid", Subject: subject });
    expect(await verifyDriverSignature("x.exe", SIGNER, { platform: "win32", run })).toMatchObject({ ok: true, skipped: false });
  });

  it("fails safe when PowerShell fails or prints garbage", async () => {
    const boom = async () => {
      throw new Error("powershell sumiu");
    };
    expect(await verifyDriverSignature("x.exe", SIGNER, { platform: "win32", run: boom })).toMatchObject({ ok: false });
    const garbage = async () => "isso não é json";
    expect(await verifyDriverSignature("x.exe", SIGNER, { platform: "win32", run: garbage })).toMatchObject({ ok: false });
  });

  it("outside Windows: skipped with a clear message, or a failure when the CI demands it", async () => {
    const skipped = await verifyDriverSignature("x.exe", SIGNER, { platform: "linux", env: {} });
    expect(skipped).toMatchObject({ ok: true, skipped: true });
    expect(skipped.reason).toContain("NÃO verificada");
    const required = await verifyDriverSignature("x.exe", SIGNER, { platform: "linux", env: { DRIVERS_REQUIRE_SIGNATURE: "1" } });
    expect(required).toMatchObject({ ok: false });
  });
});
