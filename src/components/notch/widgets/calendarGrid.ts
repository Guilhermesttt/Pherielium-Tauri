export interface CalendarCell {
  day: number;
  /** pertence ao mês exibido (falso = dias de preenchimento do mês vizinho) */
  inMonth: boolean;
  isToday: boolean;
}

export const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

/** Semanas (domingo a sábado) do mês de `reference`, completas com dias dos meses vizinhos. */
export function monthGrid(reference: Date, today: Date = new Date()): CalendarCell[][] {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevious = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevious - i, inMonth: false, isToday: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    cells.push({ day, inMonth: true, isToday });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: next++, inMonth: false, isToday: false });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "outubro 2026" */
export function monthTitle(reference: Date, locale = "pt-BR"): string {
  return reference.toLocaleDateString(locale, { month: "long", year: "numeric" });
}
