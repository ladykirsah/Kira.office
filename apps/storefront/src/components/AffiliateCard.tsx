import type { AffiliateItemRow } from "@/lib/db";
import { imgUrl } from "@/lib/img";

/** Partner marketplace label + CTA colour class, keyed by AffiliateItemRow.source. */
const SOURCE: Record<string, { label: string; cls: string }> = {
  shopee: { label: "Shopee", cls: "rec-cta--shopee" },
  lazada: { label: "Lazada", cls: "rec-cta--lazada" },
};

/**
 * Mechanic-picks affiliate card (owner-approved "Design 1"): a curated partner-tool recommendation,
 * NOT one of our own products. The whole card is a single new-tab outbound link through /go/:id
 * (click-counted before the partner redirect). The freeform partner price shows in neutral ink under
 * a "ราคาบน {platform} อาจมีการเปลี่ยนแปลง" label — deliberately NOT the brand-deep price colour the
 * store reserves for its own money. The platform-coloured CTA matches ProductCard's add-to-cart
 * button in size/shape and always names the platform + ↗, so the outbound jump is unmistakable
 * (Shopee's orange is nearly our brand orange, so colour alone can't carry it).
 */
export function AffiliateCard({ item }: { item: AffiliateItemRow }) {
  const src = SOURCE[item.source];
  const platform = src?.label;
  const ctaCls = src ? src.cls : "rec-cta--generic";
  const ctaLabel = platform ? `ซื้อบน ${platform} ↗` : "ไปที่ร้านค้า ↗";
  const priceLabel = platform
    ? `ราคาบน ${platform} อาจมีการเปลี่ยนแปลง`
    : "ราคาบนแพลตฟอร์มพาร์ทเนอร์ อาจมีการเปลี่ยนแปลง";

  return (
    <a
      href={`/go/${item.id}`}
      target="_blank"
      rel="sponsored nofollow noopener"
      className="rec-card"
      aria-label={`${item.title}${platform ? ` — ซื้อบน ${platform}` : ""} (เปิดแท็บใหม่)`}
    >
      <div className="rec-frame">
        {item.imageKey ? (
          <img src={imgUrl(item.imageKey)} alt={item.title} loading="lazy" />
        ) : (
          <span aria-hidden="true" className="star">
            ✦
          </span>
        )}
      </div>
      <div className="rec-body">
        <div className="rec-kicker">ช่างแนะนำ</div>
        <div className="rec-title">{item.title}</div>
        {item.priceText ? (
          <>
            <div className="rec-pricelab">{priceLabel}</div>
            <div className="rec-price">{item.priceText}</div>
          </>
        ) : null}
        <span className={`rec-cta ${ctaCls}`}>{ctaLabel}</span>
      </div>
    </a>
  );
}
