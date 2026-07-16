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

/** A stored timestamp (ms) as "DD/MM/YYYY · HH:MM" (24-hour, viewer-local). */
export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

/**
 * A Thai phone for display: 0812345678 → "081-234-5678" (and the 9-digit form → "02-123-4567").
 * Anything unexpected is returned untouched rather than mangled.
 *
 * Lives here, not in a page, because two screens now show a phone number — the account card and its
 * edit flow — and a number that formats differently on each would read as two different numbers.
 */
export function formatThaiPhone(digits: string): string {
  if (/^\d{10}$/.test(digits))
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (/^\d{9}$/.test(digits))
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  return digits;
}
