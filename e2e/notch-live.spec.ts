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

test("notch: aba Controle (Xbox, PlayStation, desconectado)", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  const notch = page.locator("[data-notch-root]");
  await expect(notch).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1500);
  const send = (detail: Record<string, unknown>) =>
    page.evaluate((d) => window.dispatchEvent(new CustomEvent("pherielium:controller-state", { detail: d })), detail);
  await notch.locator("div.cursor-pointer").first().click();
  await page.waitForTimeout(900);
  const clip = { x: 660, y: 0, width: 600, height: 300 };

  await send({ connected: true, brand: "xbox", link: "bluetooth", name: "Xbox Wireless Controller", battery: 85, charging: false });
  await notch.getByRole("tab", { name: "Controle" }).click();
  await expect(notch.getByText("Controle Xbox")).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, "notch-controller-xbox.png"), clip });

  await send({ connected: true, brand: "playstation", link: "usb", name: "DualSense Wireless Controller", battery: 24, charging: true });
  await expect(notch.getByText("Controle PlayStation")).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, "notch-controller-ps.png"), clip });

  await send({ connected: false, brand: "generic", link: "unknown", name: "", battery: null });
  await expect(notch.getByText("Nenhum controle")).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, "notch-controller-none.png"), clip });
  await context.close();
});

test("notch: várias conquistas entram em fila com contador", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  const notch = page.locator("[data-notch-root]");
  await expect(notch).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    ["Primeira vitória", "Explorador", "Colecionador"].forEach((title, i) =>
      window.dispatchEvent(
        new CustomEvent("pherielium:notch-event", {
          detail: { id: `ach-${i}`, kind: "achievement", title, tier: "bronze", description: "Teste", at: Date.now() },
        }),
      ),
    );
  });
  await expect(notch.getByText("Primeira vitória")).toBeVisible();
  await expect(notch.getByText("+2 na fila")).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "notch-achievement-queue.png"), clip: { x: 660, y: 0, width: 600, height: 220 } });
  await context.close();
});
