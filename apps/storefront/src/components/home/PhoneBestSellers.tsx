import Link from "next/link";
import { resolveEffectivePrice } from "@l-shopee/core";
import type { BestSeller } from "@/lib/db";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";
import { productHref } from "@/lib/seo";

/** Medal per rank: brand red · silver · bronze · grey (board 1 drawing). */
const MEDAL = ["#e10000", "#a3a8ae", "#b4783f", "#8e8e93", "#8e8e93"];

/**
 * ขายดี on the phone (owner's pick "A with horizon frames for all", 5 Nov 2026): 5 wide rows, each a
 * 132px photo with a TOP-N pennant + "ขายดีอันดับ N", the name, then the price and "ขายเดือนละ N ชิ้น"
 * (hidden with no sales yet). Photo and words are the same height. No product code.
 */
export function PhoneBestSellers({ items }: { items: BestSeller[] }) {
  const now = Date.now();
  return (
    <section className="hm-sec hm-best" aria-label="ขายดี">
      <div>
        <h2 className="hm-best-t">ขายดี</h2>
        <p className="hm-muted-sm">จากยอดขาย 90 วันล่าสุด</p>
      </div>
      {items.slice(0, 5).map((item, i) => {
        const rank = i + 1;
        const medal = MEDAL[i] ?? MEDAL[MEDAL.length - 1];
        const eff = resolveEffectivePrice(item.priceSatang, item.campaign, now);
        return (
          <Link key={item.variantId} href={productHref(item)} className="hm-best-row">
            <span className="hm-best-pic">
              {item.imageKey ? (
                <img src={imgUrl(item.imageKey)} alt={item.name} loading="lazy" />
              ) : (
                <span aria-hidden="true">✦</span>
              )}
              <span className="hm-ribbon" style={{ background: medal }}>
                <span className="hm-ribbon-top">TOP</span>
                <span className="hm-ribbon-n">{rank}</span>
              </span>
            </span>
            <span className="hm-best-info">
              <span className="hm-best-upper">
                <span className="hm-rank" style={{ background: medal }}>
                  ขายดีอันดับ {rank}
                </span>
                <span className="hm-name2 hm-name2--15">{item.name}</span>
              </span>
              <span className="hm-best-lower">
                <span className="hm-best-price">{baht(eff.priceSatang)}</span>
                {item.monthlySales !== null && (
                  <span className="hm-muted-sm">ขายเดือนละ {item.monthlySales} ชิ้น</span>
                )}
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}
