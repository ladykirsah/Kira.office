/**
 * Discount-percentage tag — the storefront's ONE canonical design (owner-set default, 2026-07-12):
 * an OUTLINE pill (brand-deep text + 1px brand-deep border, no fill) reading "-N%". Shared by the
 * product card and the PDP so every inline discount % looks identical. Renders nothing unless there
 * is a real markdown (compareAt strictly above the selling price).
 */
export function DiscountTag({
  priceSatang,
  compareAtSatang,
}: {
  priceSatang: number;
  compareAtSatang: number | null;
}) {
  if (compareAtSatang === null || compareAtSatang <= priceSatang) return null;
  const pct = Math.round(((compareAtSatang - priceSatang) / compareAtSatang) * 100);
  if (pct <= 0) return null;
  return (
    <span
      style={{
        color: "var(--brand-deep)",
        border: "1px solid var(--brand-deep)",
        fontSize: 10,
        fontWeight: 700,
        padding: "0 3px",
        borderRadius: 3,
        lineHeight: "15px",
      }}
    >
      -{pct}%
    </span>
  );
}
