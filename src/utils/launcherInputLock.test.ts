import { afterEach, describe, expect, it } from "vitest";
import {
  acquireLauncherInputLock,
  isLauncherInputLocked,
  setLauncherInputLocked,
} from "./launcherInputLock";

afterEach(() => setLauncherInputLocked(false));

describe("launcherInputLock", () => {
  it("começa destravado", () => {
    expect(isLauncherInputLocked()).toBe(false);
  });

  it("o bloqueio externo (overlay) continua funcionando como antes", () => {
    setLauncherInputLocked(true);
    expect(isLauncherInputLocked()).toBe(true);
    setLauncherInputLocked(false);
    expect(isLauncherInputLocked()).toBe(false);
  });

  it("uma concessão trava e devolvê-la destrava", () => {
    const release = acquireLauncherInputLock();
    expect(isLauncherInputLocked()).toBe(true);
    release();
    expect(isLauncherInputLocked()).toBe(false);
  });

  it("devolver duas vezes não tira a concessão de outro dono", () => {
    const a = acquireLauncherInputLock();
    const b = acquireLauncherInputLock();
    a();
    a(); // duplicado: não pode contar como devolução da b
    expect(isLauncherInputLocked()).toBe(true);
    b();
    expect(isLauncherInputLocked()).toBe(false);
  });

  it("uma ferramenta que termina NÃO destrava o que o overlay ainda segura", () => {
    // O bug que isto resolve: antes era um booleano único e o último a escrever vencia.
    setLauncherInputLocked(true);
    const release = acquireLauncherInputLock();
    release();
    expect(isLauncherInputLocked()).toBe(true);
  });

  it("o overlay liberar NÃO derruba o teste que ainda está rodando", () => {
    const release = acquireLauncherInputLock();
    setLauncherInputLocked(true);
    setLauncherInputLocked(false);
    expect(isLauncherInputLocked()).toBe(true);
    release();
  });

  it("duas ferramentas simultâneas só destravam quando as duas terminam", () => {
    const a = acquireLauncherInputLock();
    const b = acquireLauncherInputLock();
    a();
    expect(isLauncherInputLocked()).toBe(true);
    b();
    expect(isLauncherInputLocked()).toBe(false);
  });
});
