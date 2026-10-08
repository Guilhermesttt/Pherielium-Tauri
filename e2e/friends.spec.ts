import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { installHarness } from "./fixtures";

const outDir = path.resolve(import.meta.dirname, "screenshots", process.env.SHOTS_LABEL ?? "after");

test("amigos: lista + painel", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const { mount } = await import(/* @vite-ignore */ "/e2e/preview/friends-preview.tsx");
    document.body.innerHTML = '<div id="x" style="position:fixed;inset:0;z-index:99999;background:#0b0b0e;padding:32px;overflow:auto"></div>';
    mount(document.getElementById("x")!);
  });
  await page.waitForTimeout(600);
  await expect(page.getByRole("heading", { name: "Ana Souza" })).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "friends-roster.png") });
  await page.getByRole("button", { name: /Bia Martins/ }).click();
  await expect(page.getByRole("heading", { name: "Bia Martins" })).toBeVisible();
  await page.getByRole("tab", { name: "Offline" }).click();
  await expect(page.getByRole("heading", { name: "Duda" })).toBeVisible();
  await context.close();
});
