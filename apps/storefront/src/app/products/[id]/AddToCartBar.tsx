"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart";
import { baht } from "@/lib/format";
import { LINE_OA_URL } from "@/lib/links";

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
    background: "rgba(235, 80, 49, 0.1)",
    borderRadius: 12,
    color: "var(--brand)",
    fontSize: 10,
    fontWeight: 600,
    lineHeight: 1.1,
    textDecoration: "none",
    cursor: "pointer",
  };

  const helpIcon = (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.5 8.5 0 1 1 17 0Z" />
      <circle cx="11" cy="11" r="2.3" />
      <path d="m12.8 12.8 1.7 1.7" />
    </svg>
  );

  const cartIcon = justAdded ? (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  ) : (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="17.5" cy="20" r="1.3" />
      <path d="M3 4h2l2.2 11a1.5 1.5 0 0 0 1.5 1.2h8a1.5 1.5 0 0 0 1.5-1.2l1.3-6.5" />
      <path d="M14 6.5h5.5M16.75 3.75v5.5" />
    </svg>
  );

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
