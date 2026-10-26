/**
 * Satang (how the shop stores money) as baht for a screen: thousands grouped, no ".00" on whole
 * baht, trailing zeros dropped otherwise — ฿3,450, ฿1,290.5, ฿0.05. The same rule as the web back
 * office's formatBahtTrim.
 */
export function formatBaht(satang: number): string {
  const thb = satang / 100;
  const fixed = satang % 100 === 0 ? String(Math.trunc(thb)) : thb.toFixed(2).replace(/0+$/, "");
  const [whole = "0", frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `฿${grouped}${frac ? `.${frac}` : ""}`;
}
