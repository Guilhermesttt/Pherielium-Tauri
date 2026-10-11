import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { installHarness, USER_ID, VIEWPORTS } from "./fixtures";

// Harness de verificação do passe de design: home + estados principais,
// nos 3 viewports e em 2 temas (padrão + ps5).
// SHOTS_LABEL=before|after define a subpasta de saída.
const label = process.env.SHOTS_LABEL ?? "after";
const outDir = path.resolve(import.meta.dirname, "screenshots", `audit-${label}`);

const THEMES = ["phelierium", "ps5"] as const;

async function openHome(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
  await page.waitForTimeout(2500);
}

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    test(`audit ${theme} ${vp.name}`, async ({ browser }) => {
      mkdirSync(outDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      await installHarness(context, {
        localStorage: { [`checkpoint_visual_theme_${USER_ID}`]: theme },
      });
      const page = await context.newPage();
      await openHome(page);
      await expect(page.locator("[data-game-card]").first()).toBeVisible();
      await page.screenshot({ path: path.join(outDir, `home-${theme}-${vp.name}.png`) });

      // Foco no primeiro card: o anel não pode ser cortado na borda do carrossel.
      await page.locator("[data-game-card]").first().focus();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, `focus-${theme}-${vp.name}.png`) });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await context.close();
    });
  }
}

for (const vp of VIEWPORTS) {
  // O hero é só título + estatísticas (Jogar/Detalhes saíram: o controle e os
  // cards fazem isso). Título longo não pode ser truncado cedo demais, e o
  // rodapé de legendas do controle tem que ficar DENTRO da tela.
  test(`hero titulo longo ${vp.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    await installHarness(context);
    const page = await context.newPage();
    await openHome(page);

    // O carrossel virtualiza; filtra pela busca para o jogo de título longo
    // virar o único resultado (e, portanto, o selecionado).
    await page.getByRole("button", { name: "Abrir pesquisa" }).click();
    await page.locator('input[placeholder="Buscar..."]').fill("Witcher");
    await page.waitForTimeout(1500);

    const r = await page.evaluate(() => {
      const h1 = document.querySelector("h1") as HTMLElement;
      const stats = h1.parentElement?.nextElementSibling as HTMLElement;
      return {
        cortado: h1.scrollWidth > h1.clientWidth + 1,
        statsAbaixo: stats.getBoundingClientRect().top >= h1.getBoundingClientRect().bottom - 2,
        botoes: [...document.querySelectorAll("button")].filter((b) =>
          /^(Jogar Agora|Detalhes)$/.test(b.textContent?.trim() ?? ""),
        ).length,
      };
    });

    expect(r.cortado, "título truncado cedo demais").toBe(false);
    expect(r.statsAbaixo, "estatísticas devem ficar abaixo do título").toBe(true);
    expect(r.botoes, "Jogar Agora/Detalhes não ficam mais no hero").toBe(0);
    await context.close();
  });
}
