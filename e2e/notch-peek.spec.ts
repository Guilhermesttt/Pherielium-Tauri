import { expect, test } from "@playwright/test";
import { installHarness } from "./fixtures";

/**
 * Notch escondido (tela cheia de outro app): a Pherie espia pela borda de cima,
 * dá um piado e some, uma vez só por esconder.
 */
test("pherie espia uma vez quando o notch está escondido", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForSelector("[data-notch-root]", { timeout: 45_000 });
  await page.waitForTimeout(2000);
  // Novidades da versão cobrem o hub inteiro: fecha para ver o notch.
  await page.getByRole("button", { name: "Fechar novidades" }).click({ timeout: 5000 }).catch(() => undefined);

  // Conta os osciladores: cada piado sintetizado cria um por nota.
  await page.evaluate(() => {
    const w = window as unknown as { __osc: number };
    w.__osc = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.__osc += 1;
      return original.call(this);
    };
  });

  // Tela cheia do DOM conta como "outro app em foco": o notch se esconde.
  await page.evaluate(() => document.documentElement.requestFullscreen().catch(() => undefined));
  const notch = page.locator("[data-notch-root]");
  await expect(notch).toHaveClass(/-translate-y-\[64px\]/, { timeout: 10_000 });

  const peek = page.locator("[data-notch-peek]");
  await expect(peek).toHaveCount(0);
  await expect(peek).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "e2e/screenshots/notch-peek.png", clip: { x: 340, y: 0, width: 600, height: 120 } });
  await page.screenshot({ path: "e2e/screenshots/notch-peek-full.png" });
  expect(await page.evaluate(() => (window as unknown as { __osc: number }).__osc)).toBeGreaterThan(0);

  // Ela vai embora sozinha e NÃO volta enquanto o notch continuar escondido (uma vez só).
  await expect(peek).toHaveCount(0, { timeout: 10_000 });
  await page.waitForTimeout(8_000);
  await expect(peek).toHaveCount(0);
  await context.close();
});
