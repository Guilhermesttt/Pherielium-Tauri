import { expect, test } from "@playwright/test";
import { installHarness, VIEWPORTS } from "./fixtures";

/**
 * O notch é `position: fixed` no topo central da tela e já cobriu a pill de
 * abas do header duas vezes. Em Tauri quem desenha o notch é a janela de
 * overlay — outro documento —, então o hub reserva o espaço sozinho via
 * --notch-h / --titlebar-h / --header-pt-safe (src/index.css + src/App.tsx).
 * Este teste trava esse contrato.
 */
const NOTCH_BOTTOM = 52; // altura da barra do notch (NOTCH_BAR_HEIGHT)

type Probe = { notchH: string; tabsTop: number; logoTop: number };

for (const vp of VIEWPORTS) {
  test(`header livre do notch ${vp.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    await installHarness(context);
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
    await page.waitForTimeout(1500);

    const out = await page.evaluate(() => {
      const root = document.documentElement;
      const probe = () => {
        const tabs = document.querySelector("[role=tablist]") as HTMLElement;
        const logo = document.querySelector("header[role=banner] button") as HTMLElement;
        return {
          notchH: getComputedStyle(root).getPropertyValue("--notch-h").trim(),
          tabsTop: Math.round(tabs.getBoundingClientRect().top),
          logoTop: Math.round(logo.getBoundingClientRect().top),
        };
      };
      const janela = probe();
      // tela cheia: a title bar vira `fixed` e sai do fluxo
      root.style.setProperty("--titlebar-h", "0px");
      const telaCheia = probe();
      root.style.setProperty("--titlebar-h", "36px");
      // notch desligado nas configurações: nada de espaço reservado à toa
      root.style.setProperty("--notch-h", "0px");
      const notchOff = probe();
      return { janela, telaCheia, notchOff };
    });

    // com o notch ligado o hub reserva a altura da barra
    expect(out.janela.notchH).toBe(`${NOTCH_BOTTOM}px`);

    for (const [modo, p] of Object.entries(out) as [string, Probe][]) {
      if (modo === "notchOff") continue;
      expect(p.tabsTop, `${modo}: abas sob o notch`).toBeGreaterThanOrEqual(NOTCH_BOTTOM);
      expect(p.logoTop, `${modo}: logo sob o notch`).toBeGreaterThanOrEqual(NOTCH_BOTTOM);
    }

    // sem notch o header não pode ganhar espaço sobrando
    expect(out.notchOff.tabsTop).toBeLessThan(out.telaCheia.tabsTop);

    await context.close();
  });
}
