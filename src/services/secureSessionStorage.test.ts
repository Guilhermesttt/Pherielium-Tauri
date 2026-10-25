import { describe, expect, it, vi } from "vitest";
import { createSecureSessionStorage, type SecureSessionBackend } from "./secureSessionStorage";

function memoryBackend(): SecureSessionBackend & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const KEY = "sb-teste-auth-token";

describe("createSecureSessionStorage", () => {
  it("grava no cofre e não deixa cópia no localStorage", async () => {
    const backend = memoryBackend();
    const legacy = memoryStorage({ [KEY]: "antigo" });
    const storage = createSecureSessionStorage(backend, legacy);

    await storage.setItem(KEY, "novo");

    expect(backend.data.get(KEY)).toBe("novo");
    expect(legacy.data.has(KEY)).toBe(false);
  });

  it("migra a sessão que estava no localStorage na primeira leitura", async () => {
    const backend = memoryBackend();
    const legacy = memoryStorage({ [KEY]: "sessao-em-texto" });
    const storage = createSecureSessionStorage(backend, legacy);

    expect(await storage.getItem(KEY)).toBe("sessao-em-texto");
    expect(backend.data.get(KEY)).toBe("sessao-em-texto");
    expect(legacy.data.has(KEY)).toBe(false);
  });

  it("não apaga a cópia antiga se a gravação no cofre falhar", async () => {
    const backend = memoryBackend();
    backend.set = async () => {
      throw new Error("cofre fora do ar");
    };
    const legacy = memoryStorage({ [KEY]: "sessao" });
    const warn = vi.fn();
    const storage = createSecureSessionStorage(backend, legacy, warn);

    expect(await storage.getItem(KEY)).toBe("sessao");
    expect(legacy.data.get(KEY)).toBe("sessao");
    expect(warn).toHaveBeenCalled();
  });

  it("cai no localStorage ao gravar quando o cofre falha", async () => {
    const backend = memoryBackend();
    backend.set = async () => {
      throw new Error("cofre fora do ar");
    };
    const legacy = memoryStorage();
    const storage = createSecureSessionStorage(backend, legacy, vi.fn());

    await storage.setItem(KEY, "valor");

    expect(legacy.data.get(KEY)).toBe("valor");
  });

  it("retorna null quando não há sessão em lugar nenhum", async () => {
    const storage = createSecureSessionStorage(memoryBackend(), memoryStorage());
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it("remove dos dois lugares ao sair", async () => {
    const backend = memoryBackend();
    backend.data.set(KEY, "valor");
    const legacy = memoryStorage({ [KEY]: "valor" });
    const storage = createSecureSessionStorage(backend, legacy);

    await storage.removeItem(KEY);

    expect(backend.data.has(KEY)).toBe(false);
    expect(legacy.data.has(KEY)).toBe(false);
  });
});
