import Link from "next/link";

/**
 * Horizontal, swipeable compact-thumbnail row (owner-approved "Design 2"). Generic: each tile has a
 * square image (representative photo; ✦ placeholder until photos land), a Thai headline `name`, an
 * optional English `nameEn` sub-line (regular gray), and an optional `subtitle` (e.g. a product
 * count). Used for BOTH the home category browser and the by-brand browser so they read identically.
 * Pure display → a server component. Renders nothing when there are no items.
 */
export function CategoryRow({
  items,
}: {
  items: { href: string; name: string; nameEn?: string; subtitle?: string; image?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="hrow">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="cat-card">
          <div className="cat-thumb">
            {item.image ? (
              <img src={item.image} alt={item.name} loading="lazy" />
            ) : (
              <span aria-hidden="true" className="star">
                ✦
              </span>
            )}
          </div>
          <div className="cat-name">{item.name}</div>
          {item.nameEn && <div className="cat-name-en">{item.nameEn}</div>}
          {item.subtitle && <div className="cat-sub">{item.subtitle}</div>}
        </Link>
      ))}
    </div>
  );
}
