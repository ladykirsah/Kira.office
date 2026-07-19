"use client";

import { useEffect, useState } from "react";
import type { CatalogItem } from "@/lib/db";
import { ProductCard } from "@/components/ProductCard";

/**
 * "ดูล่าสุด" — purely client-side recently-viewed list in localStorage (same bet as the cart:
 * no server persistence for browse state). RecordView writes on PDP mount; RecentlyViewed reads
 * after mount only, so the server snapshot is empty and hydration never mismatches. Shown ONLY on
 * the account page (owner call) — the PDP still records views, it just no longer displays them.
 */
export interface RecentItem {
  productId: string;
  name: string;
  priceSatang: number;
  imageKey: string | null;
  productRef: string;
  variantId: string;
  /** Brand name for the card's gray brand pill; older stored entries omit it (pill just hides). */
  brandName?: string | null;
  /** Part-type name — added later; older stored entries omit it. Used by /search to re-rank
   *  suggestions toward the types a returning visitor has shown interest in. */
  typeName?: string | null;
}

const KEY = "airplus.recent.v1";
const CAP = 12;

function readList(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentItem =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as RecentItem).productId === "string" &&
        typeof (x as RecentItem).name === "string" &&
        typeof (x as RecentItem).priceSatang === "number" &&
        // variantId + productRef are what the card's add-to-cart needs; drop pre-variantId
        // entries rather than render a card whose button would push an undefined variant.
        typeof (x as RecentItem).variantId === "string" &&
        typeof (x as RecentItem).productRef === "string",
    );
  } catch {
    return [];
  }
}

/** Read the recently-viewed list (most-recent first); [] when empty/blocked. Shared with /search. */
export function readRecentItems(): RecentItem[] {
  return readList();
}

/** Invisible PDP beacon: prepend this product (dedupe by productId, cap 12). Renders nothing. */
export function RecordView({ item }: { item: RecentItem }) {
  useEffect(() => {
    try {
      const rest = readList().filter((x) => x.productId !== item.productId);
      window.localStorage.setItem(KEY, JSON.stringify([item, ...rest].slice(0, CAP)));
    } catch {
      // localStorage blocked/full — recently-viewed is best-effort, never breaks the page
    }
    // item is a fresh object literal each server render; keying the effect by productId is the
    // real identity (one write per product view).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.productId]);
  return null;
}

/**
 * A stored RecentItem carries only what a card needs to render; the remaining CatalogItem fields are
 * display-inert defaults (ProductCard reads none of onHand / fitmentShort / warrantyDays). The stored
 * priceSatang is the EFFECTIVE price captured at view time, so campaign stays null — the card shows
 * that price as the plain price, with no stale discount chip.
 */
function toCatalogItem(item: RecentItem): CatalogItem {
  return {
    productId: item.productId,
    variantId: item.variantId,
    name: item.name,
    productRef: item.productRef,
    brandName: item.brandName ?? null,
    typeName: item.typeName ?? null,
    warrantyDays: null,
    imageKey: item.imageKey,
    priceSatang: item.priceSatang,
    onHand: 1,
    fitmentShort: null,
    campaign: null,
  };
}

export function RecentlyViewed({ currentProductId }: { currentProductId?: string }) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    setItems(readList().filter((x) => x.productId !== currentProductId));
  }, [currentProductId]);

  if (items.length === 0) return null;

  return (
    <section className="section">
      {/* Stacked section head — dark-red overline above a charcoal title — matching every other
          section (the locked AirPlus headline pattern). */}
      <div style={{ marginBottom: 14 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 6 }}>
          🕘 ดูล่าสุด · Recently Viewed
        </div>
        <h2 className="t-h2" style={{ color: "var(--gray-dark)", margin: 0 }}>
          ดูล่าสุด
        </h2>
      </div>
      <div className="product-grid">
        {items.map((item) => (
          <ProductCard key={item.productId} item={toCatalogItem(item)} />
        ))}
      </div>
    </section>
  );
}
