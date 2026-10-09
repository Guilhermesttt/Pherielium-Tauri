import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { installHarness } from "./fixtures";

const outDir = path.resolve(import.meta.dirname, "screenshots", process.env.SHOTS_LABEL ?? "after");

test("notch: atividades vivas (chamada recebida/em andamento, progresso da música)", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 560, height: 420 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const { mount } = await import(/* @vite-ignore */ "/e2e/preview/notch-live-preview.tsx");
    document.body.innerHTML = '<div id="x" style="position:fixed;inset:0;z-index:99999;background:#e9e9ee;padding:20px"></div>';
    mount(document.getElementById("x")!);
  });
  await page.waitForTimeout(800);
  await expect(page.getByRole("button", { name: "Atender" })).toBeVisible();
  await expect(page.getByText("−2:15")).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "notch-live.png") });
  await context.close();
});
