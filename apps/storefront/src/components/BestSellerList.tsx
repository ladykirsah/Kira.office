import Link from "next/link";
import { resolveEffectivePrice } from "@l-shopee/core";
import type { BestSeller } from "@/lib/db";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";

/** Medal colours for ranks 1/2/3; ranks 4+ fall back to a neutral gray. */
const RANK_COLOR = ["var(--brand)", "var(--silver)", "var(--bronze)"];

/**
 * A ranked best-seller row (owner-approved "Design 1"): a square product photo with a TOP-N medal
 * pennant, the name, a "ยอดขายเฉลี่ยต่อเดือน" sales pill (hidden when there's no sales history yet),
 * and the price. The whole row links to the PDP. Pure display → server component.
 */
function BestSellerRow({ item, rank }: { item: BestSeller; rank: number }) {
  const eff = resolveEffectivePrice(item.priceSatang, item.campaign, Date.now());
  const ribbonColor = RANK_COLOR[rank - 1] ?? "var(--gray-mid)";
  return (
    <Link href={`/products/${item.productId}`} className="bs-row">
      <div className="bs-thumb">
        {item.imageKey ? (
          <img src={imgUrl(item.imageKey)} alt={item.name} loading="lazy" />
        ) : (
          <span aria-hidden="true" className="star">
            ✦
          </span>
        )}
        <span className="bs-ribbon" style={{ background: ribbonColor }}>
          <span className="bs-ribbon-t">TOP</span>
          <span className="bs-ribbon-n">{rank}</span>
        </span>
      </div>
      <div className="bs-info">
        <div className="bs-name">{item.name}</div>
        {item.monthlySales !== null && (
          <div className="bs-sales">ยอดขายเฉลี่ยต่อเดือน: {item.monthlySales}</div>
        )}
        <div className="bs-price">{baht(eff.priceSatang)}</div>
      </div>
    </Link>
  );
}

/** Vertical Top-N best-seller list. */
export function BestSellerList({ items }: { items: BestSeller[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bs-list">
      {items.map((item, i) => (
        <BestSellerRow key={item.variantId} item={item} rank={i + 1} />
      ))}
    </div>
  );
}
