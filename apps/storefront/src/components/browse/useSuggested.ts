"use client";

import { useEffect, useState } from "react";
import type { CatalogItem } from "@/lib/db";
import { readRecentItems } from "@/components/RecentlyViewed";
import { rerankByInterest } from "@/lib/suggest";

/**
 * "สินค้าแนะนำ": the server sends ONE ordered pool (on-sale → best → latest). A new visitor sees the
 * pool head; after mount a returning visitor gets the same pool re-ranked toward the part-types they
 * looked at (leaving out ones already viewed). Reading after mount keeps the first render == server.
 */
export function useSuggested(pool: CatalogItem[], shown: number): CatalogItem[] {
  const [items, setItems] = useState<CatalogItem[]>(() => pool.slice(0, shown));
  useEffect(() => {
    const recent = readRecentItems();
    if (recent.length === 0) return; // new visitor → keep the default head (on-sale + best)
    const viewedProductIds = recent.map((r) => r.productId);
    const interestedTypes = recent
      .map((r) => r.typeName)
      .filter((t): t is string => typeof t === "string" && t.length > 0);
    setItems(rerankByInterest(pool, viewedProductIds, interestedTypes, shown));
  }, [pool, shown]);
  return items;
}
