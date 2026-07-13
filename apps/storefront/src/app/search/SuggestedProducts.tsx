"use client";

import { useEffect, useState } from "react";
import type { CatalogItem } from "@/lib/db";
import { ProductCard } from "@/components/ProductCard";
import { readRecentItems } from "@/components/RecentlyViewed";
import { rerankByInterest } from "@/lib/suggest";

/**
 * "สินค้าแนะนำ" — the server sends ONE ordered pool (on-sale → best → latest). A new visitor sees the
 * pool head. After mount we read recently-viewed: a returning visitor gets the SAME pool re-ranked
 * toward the part-types they've looked at (excluding ones already viewed), so the cards never change
 * shape and no extra request is made. Reading after mount keeps the first client render == server.
 */
const SHOWN = 6;

export function SuggestedProducts({ pool }: { pool: CatalogItem[] }) {
  const [items, setItems] = useState<CatalogItem[]>(() => pool.slice(0, SHOWN));

  useEffect(() => {
    const recent = readRecentItems();
    if (recent.length === 0) return; // new visitor → keep the default head (on-sale + best)
    const viewedProductIds = recent.map((r) => r.productId);
    const interestedTypes = recent
      .map((r) => r.typeName)
      .filter((t): t is string => typeof t === "string" && t.length > 0);
    setItems(rerankByInterest(pool, viewedProductIds, interestedTypes, SHOWN));
  }, [pool]);

  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="search-head">
        ✨ สินค้าแนะนำ <small>· Suggested</small>
      </h2>
      <div className="product-grid">
        {items.map((item) => (
          <ProductCard key={item.variantId} item={item} />
        ))}
      </div>
    </section>
  );
}
