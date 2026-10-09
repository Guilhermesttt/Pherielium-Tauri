import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { installHarness } from "./fixtures";

const outDir = path.resolve(import.meta.dirname, "screenshots", process.env.SHOTS_LABEL ?? "after");

for (const mode of ["incoming", "dock"] as const) {
  test(`chamada: ${mode}`, async ({ browser }) => {
    mkdirSync(outDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 2 });
    await installHarness(context, { tauri: false });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForTimeout(3000);
    await page.evaluate(async (m) => {
      const { mount } = await import(/* @vite-ignore */ "/e2e/preview/call-preview.tsx");
      document.body.innerHTML = '<div id="x" style="position:fixed;inset:0;z-index:99998;background:#18181b"></div>';
      mount(document.getElementById("x")!, m);
    }, mode);
    await page.waitForTimeout(1200);
    if (mode === "incoming") await expect(page.getByRole("button", { name: "Atender" })).toBeVisible();
    else await expect(page.getByRole("button", { name: "Sair da chamada" })).toBeVisible();
    await page.screenshot({ path: path.join(outDir, `call-${mode}.png`) });
    await context.close();
  });
}
