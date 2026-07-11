/**
 * Gray brand pill (e.g. "DENSO", "Coolgear"). Single source of truth for the brand-tag look so the
 * ProductCard and the cart line render it identically — change the style here, both update.
 */
export function BrandTag({ name }: { name: string }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 400,
        color: "var(--gray-mid)",
        background: "var(--hover)",
        padding: "2px 9px",
        borderRadius: 999,
      }}
    >
      {name}
    </span>
  );
}
