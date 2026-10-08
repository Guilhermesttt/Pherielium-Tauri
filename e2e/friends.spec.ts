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
  await expect(page.getByRole("heading", { name: "Leo", level: 2 }).first()).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "friends-roster.png"), fullPage: false });
  await page.evaluate(() => document.getElementById("x")!.scrollTo(0, 700));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, "friends-chats-requests.png") });
  await page.evaluate(() => document.getElementById("x")!.scrollTo(0, 0));
  await page.getByRole("button", { name: /Bia Martins/ }).first().click();
  await expect(page.getByRole("heading", { name: "Bia Martins", level: 2 }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Offline" }).click();
  await expect(page.getByRole("heading", { name: "Duda", level: 2 }).first()).toBeVisible();
  await context.close();
});
