/** Display helpers: D1 stores money as integer satang; the UI shows THB. */
export function satangToThb(satang: number): string {
  return (satang / 100).toFixed(2);
}

export function formatBaht(satang: number): string {
  return `฿${satangToThb(satang)}`;
}

/**
 * Like formatBaht but grouped with thousands commas (฿2,890) and with MINIMAL decimals: no ".00"
 * for whole baht, and trailing zeros dropped otherwise (฿2,890.50 → ฿2,890.5; ฿0.05 stays).
 */
export function formatBahtTrim(satang: number): string {
  const thb = satang / 100;
  const fixed = satang % 100 === 0 ? String(Math.trunc(thb)) : thb.toFixed(2).replace(/0+$/, "");
  const [intPart, frac] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `฿${grouped}${frac ? `.${frac}` : ""}`;
}

/** A stored timestamp (ms) as "DD/MM/YYYY · HH:MM" in the viewer's local 24-hour time. */
export function formatUpdatedAt(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
