import { describe, expect, it } from "vitest";
import {
  canCancel,
  canPause,
  canResume,
  downloadPhase,
  formatCountdown,
  formatEta,
  formatSpeed,
  guidedSteps,
  isFinished,
  percentOf,
} from "./downloadView";

describe("fase do download", () => {
  it("esperando o link vira expirou quando passa da validade", () => {
    expect(downloadPhase({ status: "waiting_link", expiresAt: 2000 }, 1000)).toBe("waiting");
    expect(downloadPhase({ status: "waiting_link", expiresAt: 2000 }, 2000)).toBe("expired");
    expect(downloadPhase({ status: "waiting_link" }, 5000)).toBe("waiting");
  });

  it("mapeia os demais estados e trata o desconhecido como erro", () => {
    expect(downloadPhase({ status: "downloading" }, 0)).toBe("downloading");
    expect(downloadPhase({ status: "paused" }, 0)).toBe("paused");
    expect(downloadPhase({ status: "completed" }, 0)).toBe("done");
    expect(downloadPhase({ status: "cancelled" }, 0)).toBe("cancelled");
    expect(downloadPhase({ status: "error" }, 0)).toBe("error");
  });
});

describe("o que dá para fazer em cada fase", () => {
  it("só baixando se pausa e só pausado se retoma", () => {
    expect(canPause("downloading")).toBe(true);
    expect(canPause("paused")).toBe(false);
    expect(canResume("paused")).toBe(true);
    expect(canResume("downloading")).toBe(false);
  });

  it("cancela até começar a instalar, e nunca o que já terminou", () => {
    for (const phase of ["waiting", "resolving", "downloading", "paused"] as const) expect(canCancel(phase)).toBe(true);
    for (const phase of ["installing", "done", "error", "cancelled", "expired"] as const) expect(canCancel(phase)).toBe(false);
    expect(isFinished("done") && isFinished("error") && isFinished("cancelled")).toBe(true);
    expect(isFinished("paused")).toBe(false);
  });
});

describe("números do download", () => {
  it("percentual nunca sai de 0 a 100 e não divide por zero", () => {
    expect(percentOf(50, 200)).toBe(25);
    expect(percentOf(300, 200)).toBe(100);
    expect(percentOf(10, 0)).toBe(0);
    expect(percentOf(undefined, undefined)).toBe(0);
  });

  it("velocidade em unidade legível", () => {
    expect(formatSpeed(0)).toBe("");
    expect(formatSpeed(512)).toBe("512 B/s");
    expect(formatSpeed(1536)).toBe("1,5 KB/s");
    expect(formatSpeed(5 * 1024 * 1024)).toBe("5 MB/s");
  });

  it("tempo restante em segundos, minutos e horas; vazio sem como estimar", () => {
    expect(formatEta(0, 1000, 100)).toBe("10 s");
    expect(formatEta(0, 125 * 100, 100)).toBe("2 min 05 s");
    expect(formatEta(0, 3780 * 100, 100)).toBe("1 h 03 min");
    expect(formatEta(0, 1000, 0)).toBe("");
    expect(formatEta(1000, 1000, 100)).toBe("");
  });

  it("contagem regressiva do pedido que espera o link", () => {
    expect(formatCountdown(1_000_000 + 872_000, 1_000_000)).toBe("14:32");
    expect(formatCountdown(1000, 5000)).toBe("0:00");
    expect(formatCountdown(undefined, 0)).toBe("");
  });
});

describe("passos da conta grátis", () => {
  const states = (phase: Parameters<typeof guidedSteps>[0]) => guidedSteps(phase).map((step) => step.state);

  it("esperando o link: a página já abriu, falta clicar em Download lento", () => {
    expect(states("waiting")).toEqual(["done", "current", "todo", "todo"]);
  });

  it("o link chegou: os três primeiros estão feitos e o download é o atual", () => {
    expect(states("resolving")).toEqual(["done", "done", "done", "current"]);
    expect(states("downloading")).toEqual(["done", "done", "done", "current"]);
  });

  it("terminou: tudo feito; erro e cancelamento não têm passos", () => {
    expect(states("done")).toEqual(["done", "done", "done", "done"]);
    expect(guidedSteps("error")).toEqual([]);
    expect(guidedSteps("cancelled")).toEqual([]);
  });
});
