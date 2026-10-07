import { mkdirSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { installHarness, VIEWPORTS } from "./fixtures";

// SHOTS_LABEL=before|after define a subpasta de saída.
const label = process.env.SHOTS_LABEL ?? "after";
const outDir = path.resolve(import.meta.dirname, "screenshots", label);

for (const vp of VIEWPORTS) {
  test(`home ${vp.name}`, async ({ browser }) => {
    mkdirSync(outDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await installHarness(context);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(outDir, `home-${vp.name}.png`) });
    if (errors.length) console.log("pageerrors:", errors.slice(0, 5));
    await context.close();
  });
}
