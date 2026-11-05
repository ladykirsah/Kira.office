import type { Metadata } from "next";
import { resolveEffectivePrice } from "@l-shopee/core";
import { bestSellers, carBrandTiles, getDb, listCatalog, type CatalogItem } from "@/lib/db";
import { resolveBrandLogo } from "@/lib/brandLogo";
import { suggestionPool } from "@/lib/suggest";
import { SearchPhone } from "@/components/browse/SearchPhone";
import { CarBrandGrid } from "./CarBrandGrid";
import { RecentSearches } from "./RecentSearches";
import { SuggestedProducts } from "./SuggestedProducts";

// Live catalog data from D1 — render per-request on the Worker (no DB at build time).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ค้นหาสินค้า — AirPlus" };

/**
 * Search landing (Shopee-style, owner-briefed): recent searches → search by car → suggested products.
 * Phones (<720px) see board 2 · 2.1 (SearchPhone, its own grey search bar); computers keep this page
 * with the sticky orange SearchLandingBar. The suggested pool is on-sale → best-sellers → latest; the
 * client shows the head to new visitors and re-ranks it toward a returning visitor's viewed part-types.
 */
export default async function SearchPage(props: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await props.searchParams;
  const db = await getDb();
  const now = Date.now();
  const [brands, onSaleRaw, best, latest] = await Promise.all([
    carBrandTiles(db),
    listCatalog(db, { onSaleOnly: true, limit: 8 }),
    bestSellers(db, { limit: 8 }),
    listCatalog(db, { limit: 12 }),
  ]);

  // onSaleOnly returns campaign candidates; keep only ones the core resolver actually discounts.
  const onSale = onSaleRaw.filter(
    (i) => resolveEffectivePrice(i.priceSatang, i.campaign, now).onSale,
  );
  const pool = suggestionPool<CatalogItem>(onSale, best, latest, 16);
  const tiles = brands.map((b) => ({
    brand: b.brand,
    th: b.nameTh?.trim() || null, // only a real Thai name (Hino has none → the English name alone)
    logo: resolveBrandLogo(b.brand, b.imageKey),
  }));

  return (
    <>
      <SearchPhone initialQ={q ?? ""} brands={tiles} pool={pool} />
      <div className="search-sections b2-desk">
        <RecentSearches />
        <CarBrandGrid brands={brands} />
        <SuggestedProducts pool={pool} />
      </div>
    </>
  );
}
