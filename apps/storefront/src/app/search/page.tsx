import type { Metadata } from "next";
import { resolveEffectivePrice } from "@l-shopee/core";
import { bestSellers, carBrandTiles, getDb, listCatalog, type CatalogItem } from "@/lib/db";
import { suggestionPool } from "@/lib/suggest";
import { CarBrandGrid } from "./CarBrandGrid";
import { RecentSearches } from "./RecentSearches";
import { SuggestedProducts } from "./SuggestedProducts";

// Live catalog data from D1 — render per-request on the Worker (no DB at build time).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ค้นหาสินค้า — AirPlus" };

/**
 * Search landing (Shopee-style, owner-briefed): recent searches → search by car → suggested products.
 * The sticky orange search bar is SearchLandingBar (a layout header, shown only on /search). The
 * suggested pool is on-sale → best-sellers → latest; the client shows the head to new visitors and
 * re-ranks it toward a returning visitor's viewed part-types.
 */
export default async function SearchPage() {
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

  return (
    <div className="search-sections">
      <RecentSearches />
      <CarBrandGrid brands={brands} />
      <SuggestedProducts pool={pool} />
    </div>
  );
}
