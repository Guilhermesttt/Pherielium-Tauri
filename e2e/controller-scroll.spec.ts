import { expect, test, type Page } from "@playwright/test";
import { installHarness } from "./fixtures";

/**
 * Rolagem pelo controle e legendas de página.
 *  - Mods: o analógico direito rola a página (o `scroll-behavior: smooth` do
 *    .hub-scroll reiniciava a animação a cada quadro e a rolagem quase não saía do lugar).
 *  - Troféus: a legenda fica fixa no rodapé, fora da área que rola.
 */
type FakePad = { axes: number[] };
declare global {
  interface Window {
    __p?: FakePad;
  }
}

async function openHome(page: Page) {
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
    window.__p = pad;
    (navigator as unknown as { getGamepads: () => unknown[] }).getGamepads = () => [pad, null, null, null];
    window.addEventListener("load", () =>
      setTimeout(
        () => window.dispatchEvent(Object.assign(new Event("gamepadconnected"), { gamepad: pad })),
        1500,
      ),
    );
  });
  await page.goto("/");
  await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
  await page.waitForTimeout(2500);
}

const goTo = async (page: Page, label: string) => {
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("checkpoint:sidebar-toggle", { detail: { expanded: true } })),
  );
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(2500);
};

const stick = (page: Page, y: number) =>
  page.evaluate((v) => {
    if (window.__p) window.__p.axes[3] = v;
  }, y);

test("mods: analógico direito rola a página", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await installHarness(context);
  const page = await context.newPage();
  await openHome(page);
  await goTo(page, "Gerenciador de Mods");

  const top = () => page.evaluate(() => (document.querySelector("[data-system-page]") as HTMLElement).scrollTop);
  expect(await top()).toBe(0);
  await stick(page, 1);
  await page.waitForTimeout(1200);
  await stick(page, 0);
  // ~22 px por quadro a 60 fps; por tempo, não por quadro: mesmo com poucos fps passa disto.
  expect(await top()).toBeGreaterThan(400);
  await context.close();
});

test("troféus: legenda fixa no rodapé, fora da rolagem", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await installHarness(context);
  const page = await context.newPage();
  await openHome(page);
  await goTo(page, "Troféus");

  const info = await page.evaluate(() => {
    const scroller = document.querySelector("[data-system-page='trophies']") as HTMLElement;
    const hint = [...document.querySelectorAll("span")].find((s) => s.textContent?.trim().toLowerCase() === "filtrar");
    const r = hint?.getBoundingClientRect();
    return {
      dentroDaRolagem: Boolean(hint && scroller.contains(hint)),
      bottom: r?.bottom ?? -1,
      vh: innerHeight,
    };
  });
  expect(info.dentroDaRolagem, "a legenda não pode rolar junto com o conteúdo").toBe(false);
  expect(info.bottom).toBeGreaterThan(0);
  expect(info.bottom).toBeLessThanOrEqual(info.vh);
  await context.close();
});
