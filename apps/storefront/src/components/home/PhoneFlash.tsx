import Link from "next/link";
import { resolveEffectivePrice } from "@l-shopee/core";
import type { CatalogItem } from "@/lib/db";
import { baht } from "@/lib/format";
import { flashScarcity } from "@/lib/flashScarcity";
import { imgUrl } from "@/lib/img";
import { productHref } from "@/lib/seo";
import { Countdown } from "@/components/Countdown";

/**
 * Phone FLASH SALE card (board 1): title + HH:MM:SS boxes + ดูทั้งหมด, then 3 deals — photo filling its
 * frame, the sale price in red, and a "เหลือ N ชิ้น" bar when the campaign has a stock cap. Only shown
 * while a campaign is running (the page passes nothing otherwise).
 */
export function PhoneFlash({ items, endsAt }: { items: CatalogItem[]; endsAt: number }) {
  const now = Date.now();
  return (
    <section className="hm-sec" aria-label="แฟลชเซล">
      <div className="hm-flash-head">
        <span className="hm-flash-t">FLASH SALE</span>
        <Countdown endsAt={endsAt} variant="boxes" />
        <Link className="hm-more" href="/products?ctx=sale">
          ดูทั้งหมด
        </Link>
      </div>
      <div className="hm-grid3">
        {items.slice(0, 3).map((item) => {
          const eff = resolveEffectivePrice(item.priceSatang, item.campaign, now);
          const left = flashScarcity(item.campaign);
          return (
            <Link key={item.variantId} href={productHref(item)} className="hm-flash-cell">
              <span className="hm-pic1">
                {item.imageKey ? (
                  <img src={imgUrl(item.imageKey)} alt={item.name} loading="lazy" />
                ) : (
                  <span aria-hidden="true">✦</span>
                )}
              </span>
              <span className="hm-flash-price">{baht(eff.priceSatang)}</span>
              {left && (
                <>
                  <span className="hm-bar">
                    <span style={{ width: `${Math.max(left.soldPct, 8)}%` }} />
                  </span>
                  <span className="hm-muted-xs">เหลือ {left.remaining} ชิ้น</span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
