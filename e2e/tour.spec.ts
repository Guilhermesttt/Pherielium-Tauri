import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { USER_ID, installHarness } from "./fixtures";

const outDir = path.resolve(import.meta.dirname, "screenshots", process.env.SHOTS_LABEL ?? "after");

test("tutorial de boas-vindas: 8 passos com foco no botão da vez", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await installHarness(context, {
    tauri: false,
    localStorage: { [`pherielium_tour_force:${USER_ID}`]: "1", [`pherielium_onboarding_tour_v1:${USER_ID}`]: "" },
  });
  const page = await context.newPage();
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Tutorial de boas-vindas" });
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, "tour-1-add-game.png") });

  // anda por todos os passos (os sem alvo na tela são pulados sozinhos)
  for (let i = 2; i <= 12; i++) {
    if (!(await dialog.isVisible())) break;
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, `tour-${i}.png`) });
    const primary = dialog.getByRole("button", { name: /Próximo|Começar|Já sei/ }).last();
    if (!(await primary.count())) break;
    await primary.click();
  }
  await expect(dialog).toBeHidden();
  await context.close();
});
