import { describe, expect, it } from "vitest";
import { closestToPlatinum } from "./trophyGoals";

const g = (title: string, t: number, u: number) => ({ game: { title }, t, u });

describe("closestToPlatinum", () => {
  it("escolhe o jogo com maior progresso que ainda não tem a Platina", () => {
    const goal = closestToPlatinum([g("A", 40, 10), g("B", 57, 41), g("C", 42, 42), g("D", 20, 5)]);
    expect(goal?.game.title).toBe("B");
    expect(goal?.remaining).toBe(16);
    expect(goal?.percent).toBe(72);
  });

  it("ignora jogos concluídos, sem conquistas e sem nenhum desbloqueio", () => {
    expect(closestToPlatinum([g("A", 42, 42), g("B", 0, 0), g("C", 30, 0)])).toBeNull();
  });

  it("arredonda como a lista, mas nunca mostra 100% antes da Platina (99,6% vira 99)", () => {
    expect(closestToPlatinum([g("A", 500, 498)])?.percent).toBe(99);
  });

  it("no empate de progresso, falta menos; depois o título", () => {
    expect(closestToPlatinum([g("Grande", 100, 50), g("Pequeno", 10, 5)])?.game.title).toBe("Pequeno");
    expect(closestToPlatinum([g("B", 10, 5), g("A", 10, 5)])?.game.title).toBe("A");
  });

  it("lista vazia devolve null", () => {
    expect(closestToPlatinum([])).toBeNull();
  });
});
