import Link from "next/link";
import { resolveEffectivePrice } from "@l-shopee/core";
import type { CatalogItem } from "@/lib/db";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";

/**
 * Compact product tile for horizontal "slide-aside" rows: full-bleed image + 2-line name + price,
 * the whole tile links to the PDP (no in-row add-to-cart). Promotion tags match the main card —
 * "ลด" corner ribbon (when on sale) + the "ส่งฟรี" ribbon. Pure display → a server component.
 */
function CompactCard({ item }: { item: CatalogItem }) {
  const eff = resolveEffectivePrice(item.priceSatang, item.campaign, Date.now());
  return (
    <Link href={`/products/${item.productId}`} className="compact-card">
      <div className="ci-frame">
        {eff.onSale && <span className="ribbon-lad">ลด</span>}
        {item.imageKey ? (
          <img src={imgUrl(item.imageKey)} alt={item.name} loading="lazy" />
        ) : (
          <span aria-hidden="true" className="star">
            ✦
          </span>
        )}
        <span className="ribbon-free">ส่งฟรี</span>
      </div>
      <div className="ci-body">
        <div className="ci-title">{item.name}</div>
        <div className="ci-prow">
          <span className="ci-price">{baht(eff.priceSatang)}</span>
          {eff.onSale && eff.compareAtSatang !== null && (
            <span className="ci-strike">{baht(eff.compareAtSatang)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * A horizontal, swipeable product group led by a branded "collection cover" card — the owner-locked
 * combo (collection layout + compact cards + the main card's promotion ribbons). The cover doubles
 * as the section header (icon · title · subtitle · count · ดูทั้งหมด) and links to `seeAllHref`.
 * Renders nothing when the group is empty (out-of-stock items are already filtered out upstream).
 */
export function CollectionRow({
  items,
  icon,
  title,
  subtitle,
  seeAllHref,
}: {
  items: CatalogItem[];
  icon?: string;
  title: string;
  subtitle?: string;
  seeAllHref: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="hrow">
      <Link href={seeAllHref} className="collection-cover" aria-label={`${title} — ดูทั้งหมด`}>
        {icon && (
          <div className="cc-ic" aria-hidden="true">
            {icon}
          </div>
        )}
        <div className="cc-ttl">{title}</div>
        {subtitle && <div className="cc-sub">{subtitle}</div>}
        <div className="cc-count">{items.length} รายการ</div>
        <div className="cc-btn">ดูทั้งหมด →</div>
      </Link>
      {items.map((item) => (
        <CompactCard key={item.variantId} item={item} />
      ))}
    </div>
  );
}
