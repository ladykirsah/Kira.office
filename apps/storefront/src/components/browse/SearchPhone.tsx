"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CatalogItem } from "@/lib/db";
import { imgUrl } from "@/lib/img";
import { readRecentSearches } from "@/lib/recentSearches";
import { productHref } from "@/lib/seo";
import { track } from "@/lib/track";
import { BrandLogo } from "@/components/home/CarSheets";
import { SearchInputBar } from "./SearchBar";
import { useSuggested } from "./useSuggested";

export interface BrandTile {
  brand: string;
  /** Thai name; null when the owner has none (Hino) → the English name stands alone */
  th: string | null;
  logo: string | null;
}

/** ค้นหาล่าสุด: the shopper's own past searches, read after mount; hidden with none. */
function RecentCard() {
  const [terms, setTerms] = useState<string[]>([]);
  useEffect(() => setTerms(readRecentSearches()), []);
  if (terms.length === 0) return null;
  return (
    <section className="b2-card">
      <h2 className="b2-ct">ค้นหาล่าสุด</h2>
      <div className="b2-chips">
        {terms.map((t) => (
          <Link key={t} href={`/products?q=${encodeURIComponent(t)}`} className="b2-chip">
            {t}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** ค้นหาตามรถของคุณ: logo, then name + Thai name as one block; the rows sit further apart. */
function BrandCard({ brands }: { brands: BrandTile[] }) {
  if (brands.length === 0) return null;
  return (
    <section className="b2-card">
      <h2 className="b2-ct">ค้นหาตามรถของคุณ</h2>
      <div className="b2-brands">
        {brands.map((b) => (
          <Link
            key={b.brand}
            href={`/products?carBrand=${encodeURIComponent(b.brand)}&ctx=brand`}
            className="b2-brand"
          >
            <BrandLogo src={b.logo} size={56} />
            <span className="b2-brand-names">
              {b.brand}
              {b.th && <span className="b2-brand-th">{b.th}</span>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** สินค้าแนะนำ = E (owner's pick): photos only, one sliding row; tap a photo → the product. */
function SuggestedRail({ pool }: { pool: CatalogItem[] }) {
  const items = useSuggested(pool, 6);
  if (items.length === 0) return null;
  return (
    <section className="b2-card b2-card--rail">
      <h2 className="b2-ct">สินค้าแนะนำ</h2>
      <div className="b2-rail">
        {items.map((item) => (
          <Link
            key={item.variantId}
            href={productHref(item)}
            aria-label={item.name}
            onClick={() => track("click", item.productId)}
          >
            {item.imageKey ? (
              <img src={imgUrl(item.imageKey)} alt="" loading="lazy" />
            ) : (
              <span className="b2-photo-none" aria-hidden="true">
                ✦
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Board 2 · 2.1 on the phone: search bar · ค้นหาล่าสุด · ค้นหาตามรถของคุณ · สินค้าแนะนำ. */
export function SearchPhone({
  initialQ,
  brands,
  pool,
}: {
  initialQ: string;
  brands: BrandTile[];
  pool: CatalogItem[];
}) {
  return (
    <div className="b2-phone">
      <SearchInputBar initialQ={initialQ} />
      <RecentCard />
      <BrandCard brands={brands} />
      <SuggestedRail pool={pool} />
    </div>
  );
}
