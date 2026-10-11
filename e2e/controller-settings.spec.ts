import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { installHarness, USER_ID, VIEWPORTS } from "./fixtures";

/**
 * Configurações › Controle: visualizador ao vivo, perfil completo, drivers e
 * perfis por jogo.
 *
 * O controle é FALSO: a Gamepad API é substituída por um objeto que o teste
 * mexe com `page.evaluate`, então dá para provar que apertar um botão acende o
 * botão certo sem hardware nenhum.
 */
const outDir = path.resolve(import.meta.dirname, "screenshots", "controller");
const THEMES = ["phelierium", "ps5"] as const;

type DriveMode = "circle" | "square" | "arc" | "rest" | "stop";

declare global {
  interface Window {
    __pad?: { buttons: Array<{ pressed: boolean; value: number }>; axes: number[] } | null;
    /** Chamadas de vibração recebidas pelo atuador falso. */
    __rumble?: Array<{ duration: number; weakMagnitude: number; strongMagnitude: number }>;
    __rumbleResets?: number;
    /** Mexe um stick sozinho (círculo, quadrado, arco, repouso com ruído). */
    __drive?: (mode: DriveMode, stick?: "left" | "right") => void;
  }
}

/** Instala um DualShock 4 falso, controlado por `window.__pad`. */
const DS4_ID = "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)";
const XBOX_ID = "Xbox 360 Controller (XInput STANDARD GAMEPAD)";

async function installFakePad(
  page: Page,
  plugged: boolean,
  padId: string = DS4_ID,
  withActuator = true,
) {
  await page.addInitScript(([startPlugged, id, hasActuator]) => {
    const blank = () => ({
      buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0, 0, 0],
    });
    window.__pad = startPlugged ? blank() : null;
    window.__rumble = [];
    window.__rumbleResets = 0;
    const actuator = {
      playEffect: async (
        _type: string,
        p: { duration: number; weakMagnitude: number; strongMagnitude: number },
      ) => {
        window.__rumble?.push(p);
        await new Promise((r) => setTimeout(r, Math.min(p.duration, 25)));
        return "complete";
      },
      reset: async () => {
        window.__rumbleResets = (window.__rumbleResets ?? 0) + 1;
        return "complete";
      },
    };

    // Motorista de stick: o ângulo vem do relógio, não do número de ticks,
    // então o resultado não depende da taxa de quadros da máquina de teste.
    let timer: ReturnType<typeof setInterval> | undefined;
    window.__drive = (mode, stick = "left") => {
      if (timer) clearInterval(timer);
      timer = undefined;
      const base = stick === "left" ? 0 : 2;
      const set = (x: number, y: number) => {
        if (!window.__pad) return;
        window.__pad.axes[base] = x;
        window.__pad.axes[base + 1] = y;
      };
      if (mode === "stop") return set(0, 0);
      const t0 = performance.now();
      timer = setInterval(() => {
        const t = performance.now() - t0;
        if (mode === "rest") {
          // drift estático + ruído alternado: o que um stick gasto faz parado
          const n = Math.floor(t / 8) % 2 === 0 ? 0.008 : -0.008;
          return set(0.03 + n, -0.02 - n);
        }
        const revMs = 2000;
        const angle = mode === "arc" ? (Math.sin(t / 400) * Math.PI) / 6 + Math.PI / 6 : (t / revMs) * 2 * Math.PI;
        const r =
          mode === "square"
            ? 1 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)))
            : 1;
        set(Math.cos(angle) * r, Math.sin(angle) * r);
      }, 4);
    };
    navigator.getGamepads = () =>
      [
        window.__pad
          ? ({
              id,
              index: 0,
              connected: true,
              mapping: "standard",
              timestamp: performance.now(),
              buttons: window.__pad.buttons.map((b) => ({ ...b, touched: b.pressed })),
              axes: [...window.__pad.axes],
              vibrationActuator: hasActuator ? actuator : null,
            } as unknown as Gamepad)
          : null,
        null,
        null,
        null,
      ] as unknown as (Gamepad | null)[];
  }, [plugged, padId, withActuator] as const);
}

const press = (page: Page, index: number, value = 1) =>
  page.evaluate(
    ([i, v]) => {
      if (window.__pad) window.__pad.buttons[i] = { pressed: v >= 0.5, value: v };
    },
    [index, value] as const,
  );

const release = (page: Page, index: number) => press(page, index, 0);

const moveStick = (page: Page, which: "left" | "right", x: number, y: number) =>
  page.evaluate(
    ([w, px, py]) => {
      if (!window.__pad) return;
      const base = w === "left" ? 0 : 2;
      window.__pad.axes[base] = px;
      window.__pad.axes[base + 1] = py;
    },
    [which, x, y] as const,
  );

async function openControllerSettings(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-game-card]", { timeout: 45_000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /JOGADOR E2E/i }).first().click();
  await page.getByRole("menuitem", { name: /Configurações/ }).click();
  await page.getByRole("button", { name: /Controles e dispositivos/ }).first().click();
  await expect(page.locator('[data-section="controller-settings"]')).toBeVisible({ timeout: 10_000 });
}

const button = (page: Page, id: string) => page.locator(`svg[aria-label="Controle ao vivo"] [data-button="${id}"]`);

test("sem controle: o visualizador pede para mexer e não finge detectar nada", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, false);
  await openControllerSettings(page);

  await expect(page.locator('svg[aria-label="Controle ao vivo"]')).toHaveAttribute("data-connected", "false");
  await expect(page.getByText("Mexa o controle ou aperte")).toBeVisible();
  await expect(page.getByRole("list", { name: "Controles conectados" })).toHaveCount(0);
  await context.close();
});

test("com controle: reconhece o DualShock 4 e mostra rótulos de PlayStation", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  await expect(page.locator('svg[aria-label="Controle ao vivo"]')).toHaveAttribute("data-connected", "true");
  const device = page.getByRole("list", { name: "Controles conectados" });
  await expect(device).toContainText("Wireless Controller");
  await expect(device).toContainText("DualShock 4");
  await expect(device).toContainText("054c:09cc");
  // Rótulo da família PlayStation, não o do Xbox.
  await expect(button(page, "face_bottom")).toBeVisible();
  await expect(page.locator('svg[aria-label="Controle ao vivo"]')).toContainText("✕");
  await context.close();
});

test("apertar um botão acende exatamente aquele botão e diz qual é", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  await expect(button(page, "face_bottom")).toHaveAttribute("data-active", "false");

  await press(page, 0); // ✕
  await expect(button(page, "face_bottom")).toHaveAttribute("data-active", "true");
  await expect(page.locator('[data-readout="pressed"]')).toHaveText("✕");
  // nenhum outro botão acendeu junto
  await expect(button(page, "face_right")).toHaveAttribute("data-active", "false");
  await expect(button(page, "lb")).toHaveAttribute("data-active", "false");

  await release(page, 0);
  await expect(button(page, "face_bottom")).toHaveAttribute("data-active", "false");
  // Depois de soltar, o último fica registrado para dar tempo de ler.
  await expect(page.locator('[data-readout="pressed"]')).toContainText("último: ✕");
  await context.close();
});

test("gatilho analógico mostra a porcentagem e enche conforme o aperto", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  await press(page, 7, 0.3);
  await expect(button(page, "rt")).toHaveAttribute("data-active", "false"); // abaixo do limiar
  await expect(button(page, "rt")).toHaveAttribute("data-value", "0.30");

  await press(page, 7, 0.62);
  await expect(button(page, "rt")).toHaveAttribute("data-active", "true");
  await expect(page.locator('[data-readout="pressed"]')).toHaveText("R2 (62%)");
  await context.close();
});

test("stick move o ponto e o anel acompanha a zona morta do perfil", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  const ring = page.locator('[data-deadzone="left"]');
  await expect(ring).toBeVisible();
  const before = Number(await ring.getAttribute("r"));

  await moveStick(page, "left", 0.5, -0.5);
  await expect(page.locator('[data-readout="left"]')).toHaveText("0.50, -0.50");

  // Mexer na zona morta do stick esquerdo muda o anel desenhado.
  await page.getByRole("slider", { name: "Zona morta do stick esquerdo" }).fill("0.3");
  await expect.poll(async () => Number(await ring.getAttribute("r"))).toBeGreaterThan(before);
  await context.close();
});

test("diagonal de eixo quadrado não faz o stick sair do desenho", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  await moveStick(page, "right", 1, 1); // diagonal "quadrada": magnitude 1,41
  await expect(page.locator('[data-readout="right"]')).toHaveText("0.71, 0.71");
  await context.close();
});

test("o perfil completo está na aba: zonas mortas separadas, curva, gatilho e A/B", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  const section = page.locator('[data-section="controller-settings"]');
  for (const name of [
    "Zona morta do stick esquerdo",
    "Zona morta do stick direito",
    "Sensibilidade",
    "Limiar dos gatilhos",
    "Intensidade da vibração",
  ]) {
    await expect(section.getByRole("slider", { name })).toBeVisible();
  }
  await expect(section.getByRole("radiogroup", { name: "Curva de resposta" })).toBeVisible();
  await expect(section.getByRole("switch", { name: "Inverter eixo Y" })).toBeVisible();
  await expect(section.getByRole("switch", { name: "Trocar A e B" })).toBeVisible();
  await expect(section.getByRole("button", { name: /Restaurar padrão/ })).toBeVisible();
  await expect(section.locator('[data-graph="stick"]')).toBeVisible();
  await expect(section.locator('[data-graph="trigger"]')).toBeVisible();
  await context.close();
});

test("drivers: mostra o que está instalado e o que falta, com a ação para baixar", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  await context.addInitScript(() => {
    window.__E2E_DRIVERS__ = { vigem: true, hidHide: false };
  });
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  await expect(page.locator('[data-driver="ViGEmBus"]')).toHaveAttribute("data-installed", "true");
  await expect(page.locator('[data-driver="HidHide"]')).toHaveAttribute("data-installed", "false");
  // Só o que falta oferece "Baixar".
  await expect(page.getByRole("button", { name: "Baixar" })).toHaveCount(1);
  await expect(
    page.locator('[data-section="controller-settings"]').getByRole("switch", { name: "Emular Xbox 360" }),
  ).toBeDisabled();
  await context.close();
});

test("sem perfis por jogo mostra o estado vazio com a orientação", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  await expect(page.locator('[data-empty="game-profiles"]')).toContainText("Nenhum jogo tem perfil próprio");
  await context.close();
});

test("Xbox: rótulos A/B/X/Y, sem touchpad, e o mesmo botão físico acende", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true, XBOX_ID);
  await openControllerSettings(page);

  await expect(page.getByRole("list", { name: "Controles conectados" })).toContainText("Xbox");
  const svg = page.locator('svg[aria-label="Controle ao vivo"]');
  await expect(svg).toContainText("A");
  await expect(svg).not.toContainText("✕"); // nada de rótulo de PlayStation
  await expect(button(page, "touchpad")).toHaveCount(0); // touchpad só existe no PlayStation

  await page.getByRole("button", { name: "Modo teste" }).click();
  await press(page, 0); // índice 0 = botão de baixo = "A" no Xbox
  await expect(button(page, "face_bottom")).toHaveAttribute("data-active", "true");
  await expect(page.locator('[data-readout="pressed"]')).toHaveText("A");
  await svg.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "settings-xbox-1920x1080.png") });
  await context.close();
});

const section = (page: Page) => page.locator('[data-section="controller-settings"]');

test("CONTROLE: sem o modo teste, apertar ○ (voltar) sai das Configurações", async ({ browser }) => {
  // Prova que o problema é real: o launcher reage ao controle que a pessoa está
  // tentando testar. Sem este teste, o do modo teste abaixo não provaria nada.
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  await press(page, 1); // ○
  await expect(section(page)).toHaveCount(0, { timeout: 5000 });
  await context.close();
});

test("modo teste: ○ e ✕ acendem no desenho e o launcher NÃO reage", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  await page.getByRole("button", { name: "Modo teste" }).click();
  await expect(page.locator('[data-test-mode="on"]')).toBeVisible();

  await press(page, 1); // ○: sem o modo, voltaria e fecharia esta tela
  await expect(button(page, "face_right")).toHaveAttribute("data-active", "true");
  await release(page, 1);
  await press(page, 0); // ✕: sem o modo, confirmaria o botão em foco
  await expect(button(page, "face_bottom")).toHaveAttribute("data-active", "true");
  await release(page, 0);

  await page.waitForTimeout(500);
  await expect(section(page)).toBeVisible(); // continuou na aba
  await expect(page.getByText("Diagnóstico do Controle")).toHaveCount(0); // nada abriu
  await context.close();
});

test("modo teste: Esc sai e devolve a navegação", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  await page.getByRole("button", { name: "Modo teste" }).click();
  await expect(page.locator('[data-test-mode="on"]')).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-test-mode="on"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Modo teste" })).toBeVisible();
  await expect(section(page)).toBeVisible(); // o Esc não fechou as Configurações junto
  await context.close();
});

test("modo teste: segurar Share + Options por 1 s sai, só com o controle", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, true);
  await openControllerSettings(page);

  await page.getByRole("button", { name: "Modo teste" }).click();
  await expect(page.locator('[data-test-mode="on"]')).toBeVisible();

  // Um aperto curto NÃO sai: quem testa os dois botões não pode ser expulso.
  await press(page, 8);
  await press(page, 9);
  await page.waitForTimeout(300);
  await release(page, 8);
  await release(page, 9);
  await expect(page.locator('[data-test-mode="on"]')).toBeVisible();

  // Segurando, sai.
  await press(page, 8);
  await press(page, 9);
  await expect(page.locator('[data-test-mode="on"]')).toHaveCount(0, { timeout: 4000 });
  await context.close();
});

const tools = (page: Page) => page.locator('[data-section="controller-tools"]');
const rumbleCalls = (page: Page) => page.evaluate(() => window.__rumble ?? []);

async function openTools(
  browser: import("@playwright/test").Browser,
  opts: { actuator?: boolean; plugged?: boolean } = {},
) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await installHarness(context);
  const page = await context.newPage();
  await installFakePad(page, opts.plugged ?? true, DS4_ID, opts.actuator ?? true);
  await openControllerSettings(page);
  await tools(page).scrollIntoViewIfNeeded();
  return { context, page };
}

test("vibração: cada modo toca os passos certos, escalados pela intensidade do perfil", async ({ browser }) => {
  const { context, page } = await openTools(browser);

  // O perfil padrão tem vibração 80%: o teste tem de sentir 80% do modo, não 100%.
  await tools(page).getByRole("button", { name: "Pesado" }).click();
  await expect.poll(async () => (await rumbleCalls(page)).length).toBe(1);
  const [heavy] = await rumbleCalls(page);
  expect(heavy.strongMagnitude).toBeCloseTo(0.8, 5); // 1.0 × 0.8
  expect(heavy.weakMagnitude).toBeCloseTo(0.32, 5); // 0.4 × 0.8
  expect(heavy.duration).toBe(700);

  await page.evaluate(() => (window.__rumble = []));
  await tools(page).getByRole("button", { name: "Rajada" }).click();
  await expect.poll(async () => (await rumbleCalls(page)).length, { timeout: 5000 }).toBe(3);

  await page.evaluate(() => (window.__rumble = []));
  await tools(page).getByRole("button", { name: "Leve" }).click();
  await expect.poll(async () => (await rumbleCalls(page)).length).toBe(1);
  const [light] = await rumbleCalls(page);
  expect(light.strongMagnitude).toBe(0); // "leve" é só o motor agudo
  expect(light.weakMagnitude).toBeGreaterThan(0);
  await context.close();
});

test("vibração: os dois motores são independentes e 'sem parar' realmente para", async ({ browser }) => {
  const { context, page } = await openTools(browser);

  await tools(page).getByRole("slider", { name: "Motor grave" }).fill("1");
  await tools(page).getByRole("slider", { name: "Motor agudo" }).fill("0");
  await tools(page).getByRole("button", { name: "Vibrar 1 segundo" }).click();
  await expect.poll(async () => (await rumbleCalls(page)).length).toBe(1);
  const [one] = await rumbleCalls(page);
  expect(one.strongMagnitude).toBeCloseTo(0.8, 5);
  expect(one.weakMagnitude).toBe(0);
  expect(one.duration).toBe(1000);

  await page.evaluate(() => (window.__rumble = []));
  await tools(page).getByRole("button", { name: "Vibrar sem parar" }).click();
  await expect.poll(async () => (await rumbleCalls(page)).length).toBeGreaterThan(2);
  await tools(page).getByRole("button", { name: "Parar" }).click();
  await expect(tools(page).getByRole("button", { name: "Vibrar sem parar" })).toBeVisible();

  const stoppedAt = (await rumbleCalls(page)).length;
  await page.waitForTimeout(500);
  expect((await rumbleCalls(page)).length, "continuou vibrando depois de Parar").toBe(stoppedAt);
  expect(await page.evaluate(() => window.__rumbleResets)).toBeGreaterThan(0);
  await context.close();
});

test("vibração: controle sem atuador desabilita os botões e explica", async ({ browser }) => {
  const { context, page } = await openTools(browser, { actuator: false });
  await expect(tools(page).locator('[data-rumble="unsupported"]')).toBeVisible();
  await expect(tools(page).getByRole("button", { name: "Pesado" })).toBeDisabled();
  await expect(tools(page).getByRole("button", { name: "Vibrar 1 segundo" })).toBeDisabled();
  await context.close();
});

test("ferramentas: sem controle conectado, nada é oferecido", async ({ browser }) => {
  const { context, page } = await openTools(browser, { plugged: false });
  await expect(tools(page).getByRole("button", { name: "Pesado" })).toBeDisabled();
  await expect(tools(page).getByRole("button", { name: "Medir drift" })).toBeDisabled();
  await expect(tools(page).getByRole("button", { name: "Iniciar" })).toBeDisabled();
  await context.close();
});

test("vibração: com a intensidade do perfil em 0% o teste avisa que não vai sentir nada", async ({ browser }) => {
  const { context, page } = await openTools(browser);
  await page.getByRole("slider", { name: "Intensidade da vibração" }).fill("0");
  await expect(tools(page).getByRole("note")).toContainText("vibração do perfil está em 0%");
  await context.close();
});

test("drift: mede o repouso, sugere uma zona morta que cobre o ruído e aplica ao perfil", async ({ browser }) => {
  const { context, page } = await openTools(browser);

  await page.evaluate(() => window.__drive?.("rest", "left"));
  await tools(page).getByRole("button", { name: "Medir drift" }).click();
  await expect(tools(page).getByText(/Não toque no stick/)).toBeVisible();
  await expect(tools(page).locator("[data-drift-suggested]")).toBeVisible({ timeout: 8000 });

  const verdict = tools(page).locator("[data-drift-suggested]");
  const suggested = Number(await verdict.getAttribute("data-drift-suggested"));
  // repouso: (0.03±0.008, −0.02∓0.008) → pior ponto (0.038, −0.028), raio ≈ 0.0472,
  // abaixo do limiar de "leve" (0.05). A sugestão tem de cobrir esse raio.
  expect(suggested).toBeGreaterThanOrEqual(0.0472);
  expect(suggested).toBeLessThanOrEqual(0.1);
  await expect(verdict).toHaveAttribute("data-drift-verdict", "ok");

  await tools(page).getByRole("button", { name: /Aplicar .* ao stick esquerdo/ }).click();
  const slider = page.getByRole("slider", { name: "Zona morta do stick esquerdo" });
  await expect(slider).toHaveValue(String(suggested));
  // o direito não foi tocado
  await expect(page.getByRole("slider", { name: "Zona morta do stick direito" })).toHaveValue("0.08");
  await context.close();
});

test("drift: durante a medição o launcher não reage ao controle", async ({ browser }) => {
  const { context, page } = await openTools(browser);
  await tools(page).getByRole("button", { name: "Medir drift" }).click();
  await expect(tools(page).getByText(/Não toque no stick/)).toBeVisible();

  await press(page, 1); // ○: fora de uma medição, sairia das Configurações
  await page.waitForTimeout(400);
  await release(page, 1);
  await expect(section(page)).toBeVisible();

  // e a concessão é devolvida ao terminar: ○ volta a funcionar
  await expect(tools(page).locator("[data-drift-suggested]")).toBeVisible({ timeout: 8000 });
  await press(page, 1);
  await expect(section(page)).toHaveCount(0, { timeout: 5000 });
  await context.close();
});

test("circularidade: círculo perfeito dá cobertura total e erro baixo", async ({ browser }) => {
  const { context, page } = await openTools(browser);
  // Como um usuário real: clica em Iniciar e SÓ DEPOIS gira o stick. Girar antes
  // fazia o stick direito rolar a página (o launcher ainda não estava bloqueado)
  // e o botão ficava se mexendo debaixo do clique por dezenas de segundos.
  await tools(page).getByRole("button", { name: "Iniciar" }).click();
  await page.evaluate(() => window.__drive?.("circle", "left"));
  await page.waitForTimeout(2600); // mais de uma volta (2 s por volta)
  await tools(page).getByRole("button", { name: "Concluir" }).click();

  const result = tools(page).locator("[data-circularity-error]");
  await expect(result).toHaveAttribute("data-circularity-complete", "true");
  expect(Number(await result.getAttribute("data-circularity-coverage"))).toBeGreaterThanOrEqual(90);
  expect(Number(await result.getAttribute("data-circularity-error"))).toBeLessThan(8);
  await context.close();
});

test("circularidade: um gate quadrado dá erro bem maior que o círculo", async ({ browser }) => {
  const { context, page } = await openTools(browser);
  await page.getByRole("radio", { name: "Direito" }).last().click();
  await tools(page).getByRole("button", { name: "Iniciar" }).click();
  await page.evaluate(() => window.__drive?.("square", "right")); // só depois de iniciar
  await page.waitForTimeout(2600);
  await tools(page).getByRole("button", { name: "Concluir" }).click();

  const result = tools(page).locator("[data-circularity-error]");
  await expect(result).toHaveAttribute("data-circularity-complete", "true");
  expect(Number(await result.getAttribute("data-circularity-error"))).toBeGreaterThan(25);
  await context.close();
});

test("circularidade: só um arco NÃO produz um erro enganoso", async ({ browser }) => {
  const { context, page } = await openTools(browser);
  await tools(page).getByRole("button", { name: "Iniciar" }).click();
  await page.evaluate(() => window.__drive?.("arc", "left")); // só depois de iniciar
  await page.waitForTimeout(1800);
  await tools(page).getByRole("button", { name: "Concluir" }).click();

  const result = tools(page).locator("[data-circularity-error]");
  await expect(result).toHaveAttribute("data-circularity-complete", "false");
  await expect(tools(page).getByText(/Dê uma volta completa/)).toBeVisible();
  // o erro mostrado é um traço, não um número calculado de um arco
  await expect(
    tools(page).getByText("Erro de circularidade").locator("xpath=following-sibling::dd[1]"),
  ).toHaveText("—");
  await context.close();
});

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    test(`aba controle ${theme} ${vp.name}`, async ({ browser }) => {
      mkdirSync(outDir, { recursive: true });
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await installHarness(context, {
        localStorage: { [`checkpoint_visual_theme_${USER_ID}`]: theme },
      });
      const page = await context.newPage();
      await installFakePad(page, true);
      await openControllerSettings(page);

      // Deixa o desenho num estado que mostra tudo: botão, gatilho e stick.
      // Modo teste: sem ele o ✕ confirmaria o botão em foco e abriria um modal por cima.
      await page.getByRole("button", { name: "Modo teste" }).click();
      await press(page, 0);
      await press(page, 7, 0.7);
      await moveStick(page, "left", 0.6, -0.4);
      await expect(button(page, "face_bottom")).toHaveAttribute("data-active", "true");
      await page.locator('svg[aria-label="Controle ao vivo"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, `settings-${theme}-${vp.name}.png`) });

      // O visualizador nunca pode estourar a largura da página.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await context.close();
    });
  }
}
