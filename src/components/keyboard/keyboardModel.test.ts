import { describe, expect, it } from "vitest";
import {
  KEY_ROWS,
  backspace,
  charOutput,
  extraOutput,
  insertText,
  moveCaret,
  type CharKeyDef,
} from "./keyboardModel";

const find = (base: string): CharKeyDef => {
  for (const row of KEY_ROWS) for (const key of row) if (key.kind === "char" && key.base === base) return key;
  throw new Error(`tecla ${base} não existe`);
};

describe("layout", () => {
  it("toda fileira soma 60 colunas (as cinco têm a mesma largura)", () => {
    for (const row of KEY_ROWS) expect(row.reduce((sum, key) => sum + key.span, 0)).toBe(60);
  });

  it("os ids das teclas são únicos", () => {
    const ids = KEY_ROWS.flat().map((key) => key.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("charOutput", () => {
  it("letra: Shift ou Caps deixa maiúscula; os dois juntos se anulam", () => {
    const a = find("a");
    expect(charOutput(a, { shift: false, caps: false })).toBe("a");
    expect(charOutput(a, { shift: true, caps: false })).toBe("A");
    expect(charOutput(a, { shift: false, caps: true })).toBe("A");
    expect(charOutput(a, { shift: true, caps: true })).toBe("a");
  });

  it("símbolo: só o Shift troca; Caps não", () => {
    const one = find("1");
    expect(charOutput(one, { shift: true, caps: false })).toBe("!");
    expect(charOutput(one, { shift: false, caps: true })).toBe("1");
    expect(charOutput(find("\\"), { shift: true, caps: false })).toBe("|");
  });

  it("acento segue as mesmas regras e emoji nunca muda", () => {
    expect(extraOutput("ç", { shift: true, caps: false })).toBe("Ç");
    expect(extraOutput("🔥", { shift: true, caps: true })).toBe("🔥");
  });
});

describe("edição com cursor", () => {
  it("insere no cursor e avança", () => {
    expect(insertText({ value: "ac", caret: 1 }, "b")).toEqual({ value: "abc", caret: 2 });
  });

  it("respeita o tamanho máximo do campo", () => {
    expect(insertText({ value: "abc", caret: 3 }, "d", 3)).toEqual({ value: "abc", caret: 3 });
    expect(insertText({ value: "ab", caret: 2 }, "cde", 4)).toEqual({ value: "abcd", caret: 4 });
  });

  it("backspace apaga antes do cursor e não passa do começo", () => {
    expect(backspace({ value: "abc", caret: 2 })).toEqual({ value: "ac", caret: 1 });
    expect(backspace({ value: "abc", caret: 0 })).toEqual({ value: "abc", caret: 0 });
  });

  it("backspace apaga um emoji inteiro, não metade dele", () => {
    expect(backspace({ value: "a🔥", caret: 3 })).toEqual({ value: "a", caret: 1 });
  });

  it("o cursor não sai do texto", () => {
    expect(moveCaret({ value: "ab", caret: 2 }, 1)).toEqual({ value: "ab", caret: 2 });
    expect(moveCaret({ value: "ab", caret: 1 }, -5)).toEqual({ value: "ab", caret: 0 });
  });
});
