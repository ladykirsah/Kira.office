"use client";

import { useState } from "react";
import Link from "next/link";
import { resolveEffectivePrice } from "@l-shopee/core";
import type { CatalogItem } from "@/lib/db";
import { addToCart } from "@/lib/cart";
import { track } from "@/lib/track";
import { baht } from "@/lib/format";
import { imgUrl } from "@/lib/img";
import { productHref } from "@/lib/seo";
import { Icon } from "@/components/Icon";
import { FitLine } from "./FitLine";

/**
 * Phone product card (board 1, owner-approved 5 Nov 2026). Order: photo (fills its frame) · name on 2
 * lines · พร้อมส่ง · extra info (fits / doesn't fit the saved car) · price + cart last. No product code.
 */
export function PhoneCard({ item }: { item: CatalogItem }) {
  const [justAdded, setJustAdded] = useState(false);
  const eff = resolveEffectivePrice(item.priceSatang, item.campaign, Date.now());
  const pct =
    eff.compareAtSatang && eff.compareAtSatang > eff.priceSatang
      ? Math.round((1 - eff.priceSatang / eff.compareAtSatang) * 100)
      : 0;

  function handleAdd() {
    track("add_to_cart", item.productId);
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
    <div className="hm-card">
      <Link
        href={productHref(item)}
        className="hm-card-link"
        onClick={() => track("click", item.productId)}
      >
        <span className="hm-card-pic">
          {item.imageKey ? (
            <img src={imgUrl(item.imageKey)} alt={item.name} loading="lazy" />
          ) : (
            <span aria-hidden="true">✦</span>
          )}
        </span>
        <span className="hm-card-body">
          <span className="hm-name2">{item.name}</span>
          <span className="hm-ready">
            <span className="hm-dot" />
            พร้อมส่ง
          </span>
          <FitLine variantId={item.variantId} hasFitment={item.fitmentShort !== null} />
        </span>
      </Link>
      <div className="hm-card-price">
        {eff.onSale && eff.compareAtSatang !== null ? (
          <span className="hm-price-sale">
            <span className="hm-price hm-price--sale">{baht(eff.priceSatang)}</span>
            <span className="hm-was">{baht(eff.compareAtSatang)}</span>
            <span className="hm-pct">-{pct}%</span>
          </span>
        ) : (
          <span className="hm-price">{baht(eff.priceSatang)}</span>
        )}
        <button
          type="button"
          className="hm-cart-btn"
          aria-label={justAdded ? "ใส่ตะกร้าแล้ว" : `ใส่ตะกร้า ${item.name}`}
          onClick={handleAdd}
        >
          <Icon name={justAdded ? "check" : "cart"} size={18} />
        </button>
      </div>
    </div>
  );
}
