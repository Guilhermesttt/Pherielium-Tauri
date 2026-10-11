import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { installHarness, USER_ID, VIEWPORTS } from "./fixtures";

/**
 * Painel rápido de controle no detalhe do jogo.
 *
 * O ponto que mais importa aqui é a trava da emulação: sem o HidHide o jogo lê
 * o controle físico E o virtual ao mesmo tempo, e a entrada chega duplicada.
 * O backend também recusa, mas a UI não pode nem oferecer o botão.
 */
const outDir = path.resolve(import.meta.dirname, "screenshots", "controller");

const THEMES = ["phelierium", "ps5"] as const;

/** Só o painel: a home tem um botão "Plataformas" que colide com o preset. */
const panelOf = (page: Page) => page.getByRole("dialog", { name: /Controle em / });

async function openControllerPanel(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
  await page.waitForTimeout(2000);
  // Abre o detalhe do jogo selecionado (o card central do carrossel).
  await page.locator("[data-game-card][aria-pressed='true']").first().click();
  await page.getByRole("button", { name: "Configuração do Controle" }).click();
  await expect(panelOf(page).getByRole("heading", { name: "Controle" })).toBeVisible();
}

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    test(`painel de controle ${theme} ${vp.name}`, async ({ browser }) => {
      mkdirSync(outDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      await installHarness(context, {
        localStorage: { [`checkpoint_visual_theme_${USER_ID}`]: theme },
      });
      const page = await context.newPage();
      await openControllerPanel(page);

      // Os presets aparecem e um deles está marcado (fábrica = "Padrão").
      const panel = panelOf(page);
      await expect(panel.getByRole("button", { name: "Padrão" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      for (const preset of ["Shooter", "Corrida", "Plataforma"]) {
        await expect(panel.getByRole("button", { name: preset })).toBeVisible();
      }

      // Veio do global: não oferece "Usar global", que seria um no-op.
      await expect(panel.getByText("Perfil global")).toBeVisible();
      await expect(panel.getByRole("button", { name: "Usar global" })).toHaveCount(0);

      await page.screenshot({ path: path.join(outDir, `panel-${theme}-${vp.name}.png`) });
      await context.close();
    });
  }
}

test("toggle de emulação fica travado sem o HidHide", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  await context.addInitScript(() => {
    window.__E2E_DRIVERS__ = { vigem: true, hidHide: false };
  });
  const page = await context.newPage();
  await openControllerPanel(page);

  const toggle = panelOf(page).getByRole("switch", { name: "Emular Xbox 360" });
  await expect(toggle).toBeDisabled();
  await expect(panelOf(page).getByText(/Precisa do HidHide instalado/)).toBeVisible();
  await expect(panelOf(page).getByRole("button", { name: /Baixar HidHide/ })).toBeVisible();
  await context.close();
});

test("com os dois drivers o toggle segue travado: o motor nativo ainda não existe", async ({ browser }) => {
  // A emulação só pode ser ligada com os drivers E com o motor que lê o controle
  // em segundo plano. Sem o motor, gravar `emulateXinput` faria a emulação ligar
  // de surpresa no dia em que ele chegar. Quando EMULATION_ENGINE_READY virar
  // true, este teste passa a esperar o toggle habilitado.
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  await context.addInitScript(() => {
    window.__E2E_DRIVERS__ = { vigem: true, hidHide: true };
  });
  const page = await context.newPage();
  await openControllerPanel(page);

  const panel = panelOf(page);
  await expect(panel.getByRole("switch", { name: "Emular Xbox 360" })).toBeDisabled();
  await expect(panel.getByText(/chega numa próxima versão/)).toBeVisible();
  // Não há o que baixar: o que falta não é driver.
  await expect(panel.getByRole("button", { name: /Baixar/ })).toHaveCount(0);
  await context.close();
});

test("mexer num preset grava e o perfil passa a ser do jogo", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await openControllerPanel(page);

  await panelOf(page).getByRole("button", { name: "Shooter" }).click();
  // O mock devolve origin "game" no save: a UI tem de refletir o override.
  await expect(panelOf(page).getByText("Perfil do jogo")).toBeVisible({ timeout: 5000 });
  await expect(panelOf(page).getByRole("button", { name: "Usar global" })).toBeVisible();
  await context.close();
});
