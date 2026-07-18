"use client";

import { useState } from "react";
import Link from "next/link";
import { resolveEffectivePrice } from "@l-shopee/core";
import type { CatalogItem } from "@/lib/db";
import { addToCart } from "@/lib/cart";
import { BrandTag } from "@/components/BrandTag";
import { DiscountTag } from "@/components/DiscountTag";
import { ReadyToShip } from "@/components/ReadyToShip";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";

/**
 * Marketplace catalog card (owner-briefed off "Design 1"): a full-bleed square product image on a
 * gray field — the brand-orange ✦ stands in until a real photo is set (the photo itself carries
 * the type / model / brand text). Kept the "ลด" ribbon (flagged for a later redesign), a
 * gray brand pill, brand-orange price with a −% chip, a "พร้อมส่ง" (ready-to-ship) status line, and
 * a compact add-to-cart. Image + text link to the PDP; the button is a sibling of the link so the
 * markup stays valid.
 *
 * Out-of-stock products are filtered out upstream (CATALOG_SELECT in lib/db.ts) — they never reach
 * a card, so the status is always "พร้อมส่ง" and the add button is always safe to press.
 */
export function ProductCard({ item }: { item: CatalogItem }) {
  const [justAdded, setJustAdded] = useState(false);
  const eff = resolveEffectivePrice(item.priceSatang, item.campaign, Date.now());

  function handleAdd() {
    addToCart(
      {
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        productRef: item.productRef,
        brandName: item.brandName,
        priceSatang: eff.priceSatang,
        imageKey: item.imageKey,
      },
      1,
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <div
      style={{
        background: "var(--white)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(55, 54, 54, 0.10)",
        display: "flex",
        flexDirection: "column",
        color: "var(--gray-dark)",
      }}
    >
      <Link href={`/products/${item.productId}`} style={{ color: "inherit", display: "block" }}>
        <div
          style={{
            position: "relative",
            aspectRatio: "1 / 1",
            background: "var(--gray-lite)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {item.imageKey ? (
            <img
              src={imgUrl(item.imageKey)}
              alt={item.name}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <span aria-hidden="true" style={{ fontSize: 46, lineHeight: 1, color: "var(--brand)" }}>
              ✦
            </span>
          )}
        </div>

        <div style={{ padding: "8px 9px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.35,
              color: "var(--gray-dark)",
              minHeight: 35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.name}
          </div>
          {/* brand tag + ready-to-ship status share one row */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            {item.brandName && <BrandTag name={item.brandName} />}
            <ReadyToShip />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                // On sale → deep-red "deal" price; full price → black.
                color: eff.onSale ? "var(--brand-deep)" : "var(--gray-dark)",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              {baht(eff.priceSatang)}
            </span>
            <DiscountTag priceSatang={eff.priceSatang} compareAtSatang={eff.compareAtSatang} />
          </div>
        </div>
      </Link>

      <div style={{ padding: "8px 9px 9px" }}>
        <button
          type="button"
          onClick={handleAdd}
          aria-label={`หยิบใส่ตะกร้า: ${item.name}`}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 999,
            background: "var(--brand)",
            color: "var(--white)",
            font: "inherit",
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 10px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {justAdded ? "เพิ่มลงตะกร้าแล้ว ✓" : "หยิบใส่ตะกร้า"}
        </button>
      </div>
    </div>
  );
}
