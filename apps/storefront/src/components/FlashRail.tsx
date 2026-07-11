import Link from "next/link";
import { resolveEffectivePrice } from "@l-shopee/core";
import type { CatalogItem } from "@/lib/db";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";

/**
 * A single flash-deal tile for the horizontal rail: image + discount badge + name + flash price
 * with strikethrough, and a scarcity bar (sold vs the campaign's stock cap) when a cap is set.
 * Pure display → server component. Links to the PDP.
 */
function FlashCard({ item }: { item: CatalogItem }) {
  const eff = resolveEffectivePrice(item.priceSatang, item.campaign, Date.now());
  const savePct =
    eff.onSale && eff.compareAtSatang && eff.compareAtSatang > eff.priceSatang
      ? Math.round(((eff.compareAtSatang - eff.priceSatang) / eff.compareAtSatang) * 100)
      : 0;

  const cap = item.campaign?.stockCap ?? null;
  const sold = item.campaign?.soldCount ?? 0;
  const remaining = cap != null ? Math.max(0, cap - sold) : null;
  // Reserve "100%" for a genuinely exhausted cap — floor + clamp so "97/100 sold" never reads 100%.
  const soldPct =
    cap && cap > 0
      ? remaining && remaining > 0
        ? Math.min(99, Math.floor((sold / cap) * 100))
        : 100
      : null;
  const barLabel =
    remaining != null && remaining <= 2 ? `⚡ เหลือ ${remaining} ชิ้น` : `ขายแล้ว ${soldPct ?? 0}%`;

  return (
    <Link href={`/products/${item.productId}`} className="flash-card">
      <div className="fl-img">
        {savePct > 0 && <span className="fl-badge">-{savePct}%</span>}
        {item.imageKey ? (
          <img src={imgUrl(item.imageKey)} alt={item.name} loading="lazy" />
        ) : (
          <span aria-hidden="true" className="star">
            ✦
          </span>
        )}
      </div>
      <div className="fl-body">
        <div className="fl-name">{item.name}</div>
        <div className="fl-prow">
          <span className="fl-price">{baht(eff.priceSatang)}</span>
          {eff.onSale && eff.compareAtSatang !== null && (
            <span className="fl-strike">{baht(eff.compareAtSatang)}</span>
          )}
        </div>
        {soldPct !== null && (
          <div className="fl-sold">
            <div className="fl-bar">
              <div className="fl-bar-fill" style={{ width: `${Math.max(soldPct, 8)}%` }} />
            </div>
            <span className="fl-sold-lab">{barLabel}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

/** Horizontal, swipeable rail of live flash deals (owner-approved "Design 3"). */
export function FlashRail({ items }: { items: CatalogItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flash-hrow">
      {items.map((item) => (
        <FlashCard key={item.variantId} item={item} />
      ))}
    </div>
  );
}
