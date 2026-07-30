const DAY_MS = 24 * 60 * 60 * 1000;

export type DatePreset = "today" | "7d" | "30d" | "month" | "lastmonth" | "custom" | "all";

/**
 * Midnight LOCAL time on the day `ms` falls in. Deliberately not `ms - (ms % DAY_MS)`: that lands on
 * UTC midnight, which in Bangkok (UTC+7) is 07:00, so a "Today" range built that way hides every
 * order placed between local midnight and 07:00.
 */
function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * A "YYYY-MM-DD" value from <input type="date"> as midnight LOCAL time. `new Date("2026-07-10")`
 * parses date-only strings as UTC per spec, which would shift the whole custom range by the offset.
 */
function parseLocalDate(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

export function dateRange(
  preset: DatePreset,
  now: number,
  customFrom: string,
  customTo: string,
): { start: number; end: number } {
  const d = new Date(now);

  switch (preset) {
    case "today":
      return { start: startOfLocalDay(now), end: now };
    case "7d":
      return { start: now - 7 * DAY_MS, end: now };
    case "30d":
      return { start: now - 30 * DAY_MS, end: now };
    case "month": {
      const s = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      return { start: s, end: now };
    }
    case "lastmonth": {
      const s = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
      const e = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      return { start: s, end: e };
    }
    case "custom": {
      const from = parseLocalDate(customFrom);
      const to = parseLocalDate(customTo);
      // The to-date is inclusive: the operator picking "20 Jul" means through the end of the 20th.
      return { start: from ?? 0, end: to != null ? to + DAY_MS : now };
    }
    default:
      return { start: 0, end: now };
  }
}
