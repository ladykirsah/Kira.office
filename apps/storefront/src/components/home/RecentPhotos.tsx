"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { imgUrl } from "@/lib/img";
import { productHref } from "@/lib/seo";
import { readRecentItems, type RecentItem } from "@/components/RecentlyViewed";

/** "ดูล่าสุด" on the phone home (board 1): photos only — no name, no price (owner, 5 Nov 2026). Read
 *  after mount (the list lives on the shopper's phone), hidden when empty. */
export function RecentPhotos() {
  const [items, setItems] = useState<RecentItem[]>([]);
  useEffect(() => {
    setItems(
      readRecentItems()
        .filter((i) => i.imageKey)
        .slice(0, 3),
    );
  }, []);
  if (items.length === 0) return null;
  return (
    <section className="hm-sec" aria-label="ดูล่าสุด">
      <div className="hm-sec-head">
        <h2 className="hm-sec-t">ดูล่าสุด</h2>
      </div>
      <div className="hm-grid3">
        {items.map((i) => (
          <Link
            key={i.productId}
            className="hm-pic1"
            aria-label={i.name}
            href={productHref({ ...i, brandName: i.brandName ?? null, fitmentShort: null })}
          >
            <img
              src={imgUrl(i.imageKey as string)}
              alt=""
              loading="lazy"
              // a photo that no longer exists drops out — never an empty or broken frame
              onError={() => setItems((all) => all.filter((x) => x.productId !== i.productId))}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
