/** Display helpers: D1 stores money as integer satang; the storefront shows THB. */

/**
 * Baht grouped with thousands commas (฿2,890) and MINIMAL decimals: no ".00" for whole baht,
 * trailing zeros dropped otherwise (฿2,890.50 → ฿2,890.5). Mirrors the admin's formatBahtTrim.
 */
export function baht(satang: number): string {
  const thb = satang / 100;
  const fixed = satang % 100 === 0 ? String(Math.trunc(thb)) : thb.toFixed(2).replace(/0+$/, "");
  const [intPart, frac] = fixed.split(".");
  const grouped = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `฿${grouped}${frac ? `.${frac}` : ""}`;
}

/** Bangkok is UTC+7 all year (no daylight saving). */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * A stored timestamp (ms) as "DD/MM/YYYY · HH:MM", 24-hour, in Bangkok time — the same on the
 * server (which runs on UTC) as in the customer's phone (bug hunt 15 Nov 2026: 7 hours early).
 */
export function formatDateTime(ms: number): string {
  const d = new Date(ms + BANGKOK_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Normalize a Thai phone for comparison/storage: digits only ("081-234 5678" → "0812345678"). */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

/** A countdown as "m:ss" (e.g. 65 → "1:05"). Floors fractions; clamps negatives to "0:00". */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
