import { describe, expect, it } from "vitest";
import { monthGrid } from "./calendarGrid";

describe("monthGrid", () => {
  // outubro de 2026: dia 1 é quinta-feira, 31 dias
  const october = new Date(2026, 9, 15);

  it("começa no domingo e tem semanas completas", () => {
    const weeks = monthGrid(october, new Date(2026, 9, 29));
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // quinta = 4º dia da semana: três dias de setembro antes do dia 1
    expect(weeks[0].slice(0, 3).map((c) => c.inMonth)).toEqual([false, false, false]);
    expect(weeks[0].slice(0, 3).map((c) => c.day)).toEqual([27, 28, 29]);
    expect(weeks[0][4]).toMatchObject({ day: 1, inMonth: true });
  });

  it("marca só o dia de hoje, e só no mês exibido", () => {
    const grid = monthGrid(october, new Date(2026, 9, 29)).flat();
    expect(grid.filter((c) => c.isToday)).toEqual([{ day: 29, inMonth: true, isToday: true }]);
    expect(monthGrid(october, new Date(2026, 10, 29)).flat().some((c) => c.isToday)).toBe(false);
  });

  it("completa a última semana com dias do mês seguinte", () => {
    // setembro de 2026 termina numa quarta: sobram 3 dias de outubro na última semana
    const last = monthGrid(new Date(2026, 8, 10), new Date()).at(-1)!;
    expect(last.at(-1)).toMatchObject({ day: 3, inMonth: false });
    expect(last.some((c) => c.inMonth && c.day === 30)).toBe(true);
    // outubro termina num sábado: a grade fecha sem preenchimento
    expect(monthGrid(october, new Date()).at(-1)!.at(-1)).toMatchObject({ day: 31, inMonth: true });
  });

  it("fevereiro bissexto tem 29 dias", () => {
    const days = monthGrid(new Date(2028, 1, 10)).flat().filter((c) => c.inMonth);
    expect(days).toHaveLength(29);
  });
});
