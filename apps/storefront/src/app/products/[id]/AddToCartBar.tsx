"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addToCart } from "@/lib/cart";
import { baht } from "@/lib/format";

interface AddToCartBarProps {
  variantId: string;
  productId: string;
  name: string;
  productRef: string;
  brandName: string | null;
  /**
   * EFFECTIVE unit price (campaign/flash-sale already resolved by the server page). Display-only,
   * like the whole cart — checkout re-prices authoritatively from D1 and never trusts this.
   */
  priceSatang: number;
  imageKey: string | null;
  onHand: number;
}

/**
 * Zara-style full-width sticky ADD bar: qty stepper + live-priced add button.
 * After adding, the button flashes a confirmation and a "go to cart" link appears.
 */
export function AddToCartBar({
  variantId,
  productId,
  name,
  productRef,
  brandName,
  priceSatang,
  imageKey,
  onHand,
}: AddToCartBarProps) {
  const maxQty = Math.min(onHand, 99);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [showCartLink, setShowCartLink] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  if (onHand <= 0) {
    return (
      <div className="sticky-bar">
        <div className="sticky-bar-inner">
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled>
            สินค้าหมด
          </button>
        </div>
      </div>
    );
  }

  const handleAdd = () => {
    addToCart({ variantId, productId, name, productRef, brandName, priceSatang, imageKey }, qty);
    setJustAdded(true);
    setShowCartLink(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustAdded(false), 1500);
  };

  const stepBtn = (disabled: boolean): React.CSSProperties => ({
    width: 40,
    height: 40,
    flex: "0 0 auto",
    padding: 0,
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: disabled ? "var(--text-faint)" : "var(--text)",
    fontSize: 18,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "default" : "pointer",
  });

  return (
    <div className="sticky-bar">
      <div className="sticky-bar-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={stepBtn(qty <= 1)}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="ลดจำนวน"
          >
            −
          </button>
          <span style={{ minWidth: 24, textAlign: "center", fontSize: 16, fontWeight: 700 }}>
            {qty}
          </span>
          <button
            type="button"
            style={stepBtn(qty >= maxQty)}
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty}
            aria-label="เพิ่มจำนวน"
          >
            +
          </button>
        </div>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdd}>
          {justAdded ? "เพิ่มลงตะกร้าแล้ว ✓" : `หยิบใส่ตะกร้า · ${baht(priceSatang * qty)}`}
        </button>
        {showCartLink && (
          <Link href="/cart" className="btn" style={{ whiteSpace: "nowrap" }}>
            ไปที่ตะกร้า
          </Link>
        )}
      </div>
    </div>
  );
}
