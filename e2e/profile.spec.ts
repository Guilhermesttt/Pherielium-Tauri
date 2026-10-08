import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { installHarness } from "./fixtures";

const outDir = path.resolve(import.meta.dirname, "screenshots", process.env.SHOTS_LABEL ?? "after");

// PNG 600x300 com degradê, gerado em tempo de teste (sem arquivo no repo)
const makePng = async (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 300;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 600, 300);
    grad.addColorStop(0, "#6366f1");
    grad.addColorStop(1, "#f472b6");
    g.fillStyle = grad;
    g.fillRect(0, 0, 600, 300);
    g.fillStyle = "#fff";
    g.font = "bold 48px sans-serif";
    g.fillText("BANNER", 200, 170);
    return c.toDataURL("image/png").split(",")[1];
  });

test("editor de perfil: banner com recorte 3:1", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const { mount } = await import(/* @vite-ignore */ "/e2e/preview/profile-editor-preview.tsx");
    document.body.innerHTML = '<div id="x"></div>';
    mount(document.getElementById("x")!);
  });
  await expect(page.getByText("Banner do perfil")).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "profile-editor-empty.png") });

  const b64 = await makePng(page);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") });
  await expect(page.getByText("Ajustar banner")).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "profile-banner-crop.png") });
  await page.getByRole("button", { name: /Aplicar Corte/ }).click();
  await expect(page.getByAltText("Prévia do banner")).toBeVisible();
  const size = await page.getByAltText("Prévia do banner").evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
  expect(size).toEqual([1200, 400]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, "profile-editor-banner.png") });

  // arquivo grande demais é recusado com mensagem clara
  await page.locator('input[type="file"]').first().setInputFiles({ name: "grande.gif", mimeType: "image/gif", buffer: Buffer.alloc(11 * 1024 * 1024) });
  await expect(page.getByRole("alert")).toContainText("no máximo 10 MB");
  await context.close();
});

test("pagina de perfil redesenhada", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await installHarness(context, {});
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /JOGADOR/i }).click();
  await page.getByRole("menuitem", { name: /perfil/i }).first().click().catch(async () => {
    await page.getByText(/Meu Perfil|Perfil/i).first().click();
  });
  await page.getByRole("button", { name: /Continuar jornada/ }).click({ timeout: 4000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, "profile-page.png") });
  await page.getByRole("button", { name: /Ocultar missões/ }).click().catch(() => undefined);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, "profile-page-2.png"), fullPage: true });
  await context.close();
});
