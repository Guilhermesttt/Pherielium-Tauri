import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { installHarness, VIEWPORTS } from "./fixtures";

// SHOTS_LABEL=before|after define a subpasta de saída.
const label = process.env.SHOTS_LABEL ?? "after";
const outDir = path.resolve(import.meta.dirname, "screenshots", label);

const LONG_TABS = [
  "RPG de Ação",
  "Jogos para jogar com os amigos no fim de semana",
  "Indies",
  "Souls-like",
  "Cooperativo local",
  "Retrô",
  "Backlog que nunca vou terminar de jogar",
].map((name, i) => ({ id: `custom_${i}`, name, gameIds: [], createdAt: i }));

async function openHome(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
  await page.waitForTimeout(2500);
}

/** Nenhum elemento principal pode vazar do viewport horizontalmente. */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const vp of VIEWPORTS) {
  test(`home ${vp.name}`, async ({ browser }) => {
    mkdirSync(outDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await installHarness(context);
    const page = await context.newPage();
    await openHome(page);
    await page.screenshot({ path: path.join(outDir, `home-${vp.name}.png`) });
    await expectNoHorizontalOverflow(page);
    await context.close();
  });

  test(`home many tabs ${vp.name}`, async ({ browser }) => {
    mkdirSync(outDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await installHarness(context, {
      localStorage: { checkpoint_custom_library_filters: JSON.stringify(LONG_TABS) },
    });
    const page = await context.newPage();
    await openHome(page);
    await page.screenshot({ path: path.join(outDir, `home-tabs-${vp.name}.png`) });

    // A pill de abas deve ficar centralizada na tela e sem invadir os grupos laterais.
    const tablist = page.getByRole("tablist");
    const box = await tablist.boundingBox();
    expect(box).not.toBeNull();
    const centerX = box!.x + box!.width / 2;
    expect(Math.abs(centerX - vp.width / 2)).toBeLessThanOrEqual(24);
    const search = await page.getByRole("button", { name: "Abrir pesquisa" }).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(search!.x);
    await expectNoHorizontalOverflow(page);
    await context.close();
  });
}

test("home 1920x1080 tema alternativo", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.documentElement.setAttribute("data-launcher-theme", "playstation");
  });
  await openHome(page);
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-launcher-theme", "playstation"),
  );
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, "home-theme-1920x1080.png") });
  await context.close();
});

for (const vp of [VIEWPORTS[0], VIEWPORTS[1]]) {
  test(`busca aberta ${vp.name}`, async ({ browser }) => {
    mkdirSync(outDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await installHarness(context, {
      localStorage: { checkpoint_custom_library_filters: JSON.stringify(LONG_TABS) },
    });
    const page = await context.newPage();
    await openHome(page);
    await page.getByRole("button", { name: "Abrir pesquisa" }).click();
    await page.keyboard.type("hades");
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, `search-${vp.name}.png`), clip: { x: 0, y: 0, width: vp.width, height: 160 } });

    const tabs = await page.getByRole("tablist").boundingBox();
    const input = await page.getByPlaceholder("Buscar...").boundingBox();
    const profile = await page.getByRole("button", { name: /JOGADOR/i }).boundingBox();
    expect(tabs).not.toBeNull();
    // a busca aberta nao invade a pill de abas nem o perfil
    expect(input!.x).toBeGreaterThanOrEqual(tabs!.x + tabs!.width);
    expect(input!.x + input!.width).toBeLessThanOrEqual(profile!.x);
    await context.close();
  });
}

test("notch encena controle conectado e desconectado", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  const notch = page.locator("[data-notch-root]");
  await expect(notch).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1500);
  const clip = { x: 660, y: 0, width: 600, height: 120 };
  const fire = (kind: string) =>
    page.evaluate((k) => {
      window.dispatchEvent(
        new CustomEvent("pherielium:controller-flash", {
          detail: { kind: k, link: "BLUETOOTH", battery: 82, at: Date.now() },
        }),
      );
    }, kind);

  await page.screenshot({ path: path.join(outDir, "notch-idle.png"), clip });
  await notch.hover();
  await notch.locator("div.cursor-pointer").first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "notch-expanded.png"), clip: { x: 660, y: 0, width: 600, height: 300 } });
  await page.mouse.move(100, 600);
  await page.waitForTimeout(2500);
  await fire("connected");
  await expect(notch.getByText("Controle conectado")).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, "notch-connected.png"), clip });
  await expect(notch.getByText("Controle conectado")).toBeHidden({ timeout: 6000 });

  await fire("disconnected");
  await expect(notch.getByText("Controle desconectado")).toBeVisible();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(outDir, "notch-disconnected.png"), clip });
  await expect(notch.getByText("Controle desconectado")).toBeHidden({ timeout: 6000 });

  await fire("hapticsOn");
  await expect(notch.getByText("Vibração ligada")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, "notch-haptics-on.png"), clip });
  await expect(notch.getByText("Vibração ligada")).toBeHidden({ timeout: 6000 });

  await fire("hapticsOff");
  await expect(notch.getByText("Vibração desligada")).toBeVisible();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(outDir, "notch-haptics-off.png"), clip });
  await context.close();
});

test("notch mostra pedido de amizade, mensagens agrupadas e conquista", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  const notch = page.locator("[data-notch-root]");
  await expect(notch).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1500);
  const clip = { x: 660, y: 0, width: 600, height: 120 };
  const fire = (detail: Record<string, unknown>) =>
    page.evaluate((d) => {
      window.dispatchEvent(new CustomEvent("pherielium:notch-event", { detail: d }));
    }, detail);

  await fire({ id: "fr-1", kind: "friend-request", title: "Marina Lopes", subtitle: "quer ser seu amigo" });
  await expect(notch.getByText("Marina Lopes")).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, "notch-friend-request.png"), clip });
  // o mesmo evento chegando duas vezes (CustomEvent + Tauri emit) não repete a barra
  await fire({ id: "fr-1", kind: "friend-request", title: "Marina Lopes", subtitle: "quer ser seu amigo" });
  await expect(notch.getByText("Marina Lopes")).toBeHidden({ timeout: 8000 });
  await expect(notch.getByText("Marina Lopes")).toBeHidden();

  await fire({ kind: "message", title: "Leo", subtitle: "bora jogar?", friendId: "f1" });
  await fire({ kind: "message", title: "Leo", subtitle: "tá aí?", friendId: "f1" });
  await fire({ kind: "message", title: "Leo", subtitle: "ei", friendId: "f1" });
  await expect(notch.getByText("3 mensagens novas")).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, "notch-messages.png"), clip });
  await expect(notch.getByText("Leo")).toBeHidden({ timeout: 8000 });

  const tiers = ["bronze", "silver", "gold", "platinum"] as const;
  for (const tier of tiers) {
    await fire({
      kind: "achievement",
      tier,
      title: tier === "platinum" ? "Lenda do Pherielium" : "Primeiro sangue",
      description: "Derrote o chefe da região sem sofrer dano nenhum durante a luta inteira.",
      gameTitle: "Hades II",
      xp: 60,
    });
    await expect(notch.getByText("Conquista desbloqueada")).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, `notch-achievement-${tier}.png`), clip: { x: 660, y: 0, width: 600, height: 220 } });
    await expect(notch.getByText("Conquista desbloqueada")).toBeHidden({ timeout: 12000 });
  }
  await context.close();
});

test("notch: cliques demais na Pherie deixam o notch tonto por 3 s", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  const notch = page.locator("[data-notch-root]");
  await expect(notch).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1500);
  await notch.locator("div.cursor-pointer").first().click();
  await page.waitForTimeout(1200);
  const mascot = notch.locator("[data-notch-panel-mascot]").first();
  await expect(mascot).toBeAttached();
  const box = (await mascot.boundingBox())!;
  for (let i = 0; i < 3; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(notch.getByText("Muitos cliques de uma vez.")).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "notch-overloaded.png"), clip: { x: 660, y: 0, width: 600, height: 300 } });
  await expect(notch.getByText("Muitos cliques de uma vez.")).toBeHidden({ timeout: 5000 });
});
