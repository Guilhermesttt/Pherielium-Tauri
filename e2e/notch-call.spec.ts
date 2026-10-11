import { expect, test } from "@playwright/test";
import { installHarness } from "./fixtures";

/**
 * Notch em chamada: expandido, a barra mostra as abas (Início/Controle); antes,
 * o cabeçalho da chamada tomava o lugar delas e a página do controle ficava
 * inacessível durante a call.
 */
test("notch em chamada: expandido mostra as abas e dá acesso ao controle", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const { mount } = await import(/* @vite-ignore */ "/e2e/preview/notch-call-preview.tsx");
    document.body.innerHTML = '<div id="x" style="position:fixed;inset:0;z-index:99999;background:#18181b"></div>';
    mount(document.getElementById("x")!);
  });
  const notch = page.locator("[data-notch-root]");
  await expect(notch).toBeVisible();

  // Recolhido: o resumo da chamada (nome + tempo), sem abas.
  await expect(notch.getByText("Tania Castillo").first()).toBeVisible();
  await expect(notch.getByRole("tab", { name: "Controle" })).toHaveCount(0);

  // Expandido: abas na barra + o cartão da chamada no painel.
  await notch.hover();
  await notch.locator("div.cursor-pointer").first().click();
  await expect(notch.getByRole("tab", { name: "Controle" })).toBeVisible();
  await expect(notch.getByText("Chamada de voz")).toBeVisible();

  // E a página do controle abre mesmo em chamada.
  await notch.getByRole("tab", { name: "Controle" }).click();
  await expect(notch.getByText("Nenhum controle")).toBeVisible();
  await context.close();
});
