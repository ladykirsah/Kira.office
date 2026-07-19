"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart";
import { baht } from "@/lib/format";
import { LINE_OA_URL } from "@/lib/links";
import { Icon } from "@/components/Icon";

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
 * Sticky action bar (Lovito/Shopee pattern): two icon actions — "ช่วยหาอะไหล่" (help find parts →
 * LINE OA) and add-to-cart — beside a full-width "ซื้อเลยตอนนี้" (buy now: add then go to checkout).
 * Quantity is fixed at 1 here and adjusted in the cart. Prices are display-only; checkout re-prices.
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
  const router = useRouter();
  const [justAdded, setJustAdded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const add = () =>
    addToCart({ variantId, productId, name, productRef, brandName, priceSatang, imageKey }, 1);

  const handleAdd = () => {
    add();
    setJustAdded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustAdded(false), 1400);
  };

  const buyNow = () => {
    add();
    router.push("/checkout");
  };

  // "Design 2" tinted chips: the two secondary actions get a soft coral-tint fill + rounded corners
  // so they read as real buttons (not floating icons) next to the filled "ซื้อเลยตอนนี้" pill.
  const iconBtn: React.CSSProperties = {
    flex: "0 0 auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: 56,
    minHeight: 44,
    padding: "0 2px",
    border: "none",
    background: "rgba(225, 0, 0, 0.1)",
    borderRadius: 12,
    color: "var(--brand)",
    fontSize: 10,
    fontWeight: 600,
    lineHeight: 1.1,
    textDecoration: "none",
    cursor: "pointer",
  };

  const helpIcon = <Icon name="chat" size={22} />;

  const cartIcon = justAdded ? <Icon name="check" size={22} /> : <Icon name="cart" size={22} />;

  const helpAction = (
    <a
      href={LINE_OA_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={iconBtn}
      aria-label="ช่วยหาอะไหล่ทาง LINE"
    >
      {helpIcon}
      <span>ช่วยหาอะไหล่</span>
    </a>
  );

  if (onHand <= 0) {
    return (
      <div className="sticky-bar">
        <div className="sticky-bar-inner" style={{ gap: 8, alignItems: "stretch" }}>
          {helpAction}
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled>
            สินค้าหมด
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky-bar">
      <div className="sticky-bar-inner" style={{ gap: 8, alignItems: "stretch" }}>
        {helpAction}
        <button type="button" style={iconBtn} onClick={handleAdd} aria-label="หยิบใส่ตะกร้า">
          {cartIcon}
          <span>{justAdded ? "เพิ่มแล้ว" : "ใส่ตะกร้า"}</span>
        </button>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={buyNow}>
          ซื้อเลยตอนนี้ · {baht(priceSatang)}
        </button>
      </div>
    </div>
  );
}
