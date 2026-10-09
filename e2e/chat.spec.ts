import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { installHarness } from "./fixtures";

const outDir = path.resolve(import.meta.dirname, "screenshots", process.env.SHOTS_LABEL ?? "after");

test("chat: balões agrupados e mensagem nova com mola", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 700, height: 640 }, deviceScaleFactor: 2 });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const { mount } = await import(/* @vite-ignore */ "/e2e/preview/chat-preview.tsx");
    document.body.innerHTML = '<div id="x" style="position:fixed;inset:0;z-index:99999;background:#111;display:flex;align-items:center;justify-content:center"></div>';
    mount(document.getElementById("x")!);
  });
  await page.waitForTimeout(800);
  await expect(page.getByText("me chama quando terminar")).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "chat-grouped.png") });
  // mensagem nova: entra com a mola (quadro intermediário e quadro final)
  await page.evaluate(() => (window as any).__chatPush({ id: "9", senderId: "me", text: "agora sim, enviado!", createdAt: new Date().toISOString() }));
  await page.waitForTimeout(110);
  await page.screenshot({ path: path.join(outDir, "chat-sending-mid.png") });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, "chat-sent.png") });
  await expect(page.getByText("agora sim, enviado!")).toBeVisible();
  await context.close();
});
