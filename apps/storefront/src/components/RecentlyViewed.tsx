"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";

/**
 * "ดูล่าสุด" — purely client-side recently-viewed list in localStorage (same bet as the cart:
 * no server persistence for browse state). RecordView writes on PDP mount; RecentlyViewed reads
 * after mount only, so the server snapshot is empty and hydration never mismatches.
 */
export interface RecentItem {
  productId: string;
  name: string;
  priceSatang: number;
  imageKey: string | null;
  productRef: string;
  variantId: string;
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
        typeof (x as RecentItem).priceSatang === "number",
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

export function RecentlyViewed({ currentProductId }: { currentProductId?: string }) {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setItems(readList().filter((x) => x.productId !== currentProductId));
  }, [currentProductId]);

  if (items.length === 0) return null;

  return (
    <section className="section">
      {/* Stacked section head — eyebrow above title, left-aligned — matching every other home
          section (Best Sellers, etc.). NOT the old flex `.section-head` that split them apart. */}
      <div style={{ marginBottom: 14 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 6 }}>
          🕘 ดูล่าสุด · Recently Viewed
        </div>
        <h2 className="t-h2" style={{ color: "var(--gray-dark)", margin: 0 }}>
          ดูล่าสุด
        </h2>
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          padding: "2px 0 6px",
          scrollbarWidth: "none",
        }}
      >
        {items.map((item) => (
          <Link
            key={item.productId}
            href={`/products/${item.productId}`}
            className="card"
            style={{
              flex: "0 0 auto",
              width: 116,
              padding: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {item.imageKey && !failed[item.productId] ? (
              <div className="frame" style={{ width: 96, height: 96, margin: "0 auto" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl(item.imageKey)}
                  alt={item.name}
                  loading="lazy"
                  onError={() => setFailed((prev) => ({ ...prev, [item.productId]: true }))}
                />
              </div>
            ) : (
              <div className="frame" style={{ width: 96, height: 96, margin: "0 auto" }}>
                <span
                  aria-hidden="true"
                  style={{ fontSize: 44, lineHeight: 1, color: "var(--brand)" }}
                >
                  ✦
                </span>
              </div>
            )}
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {item.name}
            </div>
            <div className="t-price-m">{baht(item.priceSatang)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
