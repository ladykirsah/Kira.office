/**
 * Satang (how the shop stores money) as baht for a screen: thousands grouped, no ".00" on whole
 * baht (owner, 5 Nov 2026: "remove .00"), both satang digits otherwise — ฿3,450, ฿2,814.10, ฿0.05
 * (owner, 5 Nov 2026: "฿2,814.1" → fix it).
 */
export function formatBaht(satang: number): string {
  const thb = satang / 100;
  const fixed = satang % 100 === 0 ? String(Math.trunc(thb)) : thb.toFixed(2);
  const [whole = "0", frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `฿${grouped}${frac ? `.${frac}` : ""}`;
}
