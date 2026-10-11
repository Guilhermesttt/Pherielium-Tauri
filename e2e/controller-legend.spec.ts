import { expect, test, type Page } from "@playwright/test";
import { installHarness, VIEWPORTS } from "./fixtures";

/**
 * Legendas de controle: a Home e as páginas do hub mostram os comandos do
 * gamepad quando há um controle conectado, e a faixa nunca fica cortada pela
 * borda da janela (o conteúdo da Home, antes, empurrava o rodapé para fora).
 */
const SIZES = [...VIEWPORTS, { name: "1536x864", width: 1536, height: 864 }, { name: "1920x1000", width: 1920, height: 1000 }];

const LEGEND = "footer[aria-label='Atalhos do Controle']";

async function connectPad(page: Page) {
  await page.addInitScript(() => {
    const pad = {
      id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    (navigator as unknown as { getGamepads: () => unknown[] }).getGamepads = () => [pad, null, null, null];
    window.addEventListener("load", () =>
      setTimeout(
        () => window.dispatchEvent(Object.assign(new Event("gamepadconnected"), { gamepad: pad })),
        1500,
      ),
    );
  });
}

const insideViewport = (page: Page) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom, vh: innerHeight } : null;
  }, LEGEND);

for (const vp of SIZES) {
  test(`home: legenda do controle visível e inteira ${vp.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await installHarness(context);
    const page = await context.newPage();
    await connectPad(page);
    await page.goto("/");
    await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
    await expect(page.locator(LEGEND)).toBeVisible({ timeout: 10_000 });
    const r = await insideViewport(page);
    expect(r?.bottom, "rodapé cortado pela borda da janela").toBeLessThanOrEqual(r!.vh + 0.5);
    // Os botões do hero saíram: jogar é A no controle (ou o card), detalhes é o título.
    await expect(page.getByRole("button", { name: "Jogar Agora" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Detalhes", exact: true })).toHaveCount(0);
    await context.close();
  });
}

test("home sem controle: sem legenda", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
  await page.waitForTimeout(2000);
  await expect(page.locator(LEGEND)).toHaveCount(0);
  await context.close();
});

test("configurações: legenda com voltar e navegar, dentro da tela", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await installHarness(context);
  const page = await context.newPage();
  await connectPad(page);
  await page.goto("/");
  await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
  await expect(page.locator(LEGEND)).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: /JOGADOR E2E/i }).first().click();
  await page.getByRole("menuitem", { name: /Configurações/ }).click();
  const legend = page.locator(LEGEND);
  await expect(legend.getByText("Voltar")).toBeVisible();
  await expect(legend.getByText("Navegar")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/legend-settings.png" });
  const r = await insideViewport(page);
  expect(r?.bottom).toBeLessThanOrEqual(r!.vh + 0.5);

  await context.close();
});

test("amigos: legenda com conversar, ligar e troca de aba", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await installHarness(context);
  const page = await context.newPage();
  await connectPad(page);
  await page.goto("/");
  await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
  await expect(page.locator(LEGEND)).toBeVisible({ timeout: 10_000 });

  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("checkpoint:sidebar-toggle", { detail: { expanded: true } })),
  );
  await page.getByRole("button", { name: "Amigos", exact: true }).click();
  const legend = page.locator(LEGEND);
  await expect(legend.getByText("Conversar")).toBeVisible();
  await expect(legend.getByText("Ligar")).toBeVisible();
  await expect(legend.getByText("Próxima aba")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/legend-friends.png" });
  const r = await insideViewport(page);
  expect(r?.bottom).toBeLessThanOrEqual(r!.vh + 0.5);
  await context.close();
});
