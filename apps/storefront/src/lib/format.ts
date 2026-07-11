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
