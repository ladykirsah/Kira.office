"use client";

import type { CatalogItem } from "@/lib/db";
import { ProductCard } from "@/components/ProductCard";
import { useSuggested } from "@/components/browse/useSuggested";

/** "สินค้าแนะนำ" on the computer search page: the suggested pool as product cards. */
const SHOWN = 6;

export function SuggestedProducts({ pool }: { pool: CatalogItem[] }) {
  const items = useSuggested(pool, SHOWN);

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
