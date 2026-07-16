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
 * Sticky action bar (Lovito/Shopee pattern): a blue trust rail (genuine parts + free LINE consult)
 * over three controls — a quiet "หาอะไหล่" ghost (help find parts → LINE OA), a solid-blue
 * add-to-cart (secondary CTA), and the red "ซื้อเลยตอนนี้" primary (buy now: add then checkout).
 * Blue is the highlight color; red stays the money action. Quantity is fixed at 1 here and adjusted
 * in the cart. Prices are display-only; checkout re-prices.
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

  // Shared icon-chip layout for the two side actions. `whiteSpace: nowrap` keeps the labels on one
  // line — "ช่วยหาอะไหล่" used to wrap to two lines in the 56px chip and knock the icon out of line.
  const chipBase: React.CSSProperties = {
    flex: "0 0 auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: 56,
    minHeight: 46,
    padding: "0 2px",
    border: "none",
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.05,
    whiteSpace: "nowrap",
    textDecoration: "none",
    cursor: "pointer",
  };
  // Help = quiet ghost (the blue trust rail above already surfaces the free LINE consult);
  // add-to-cart = solid blue secondary CTA; buy-now stays the red primary. Blue = the highlight color.
  const helpChip: React.CSSProperties = {
    ...chipBase,
    background: "var(--paper)",
    color: "var(--gray-mid)",
  };
  const cartChip: React.CSSProperties = {
    ...chipBase,
    background: "var(--brand-blue)",
    color: "var(--white)",
  };

  // Blue trust/confidence rail above the buttons: genuine-parts + free technician consult (LINE).
  const rail = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginBottom: 10,
        padding: "6px 10px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 700,
        color: "var(--brand-blue)",
        background: "rgba(1, 90, 191, 0.08)",
      }}
    >
      <Icon name="check" size={14} />
      <span>อะไหล่แท้ 100% · ปรึกษาช่างฟรีทาง LINE</span>
    </div>
  );

  const helpAction = (
    <a
      href={LINE_OA_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={helpChip}
      aria-label="ช่วยหาอะไหล่ทาง LINE"
    >
      <Icon name="chat" size={22} />
      <span>หาอะไหล่</span>
    </a>
  );

  const cartIcon = justAdded ? <Icon name="check" size={22} /> : <Icon name="cart" size={22} />;

  if (onHand <= 0) {
    return (
      <div className="sticky-bar">
        {rail}
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
      {rail}
      <div className="sticky-bar-inner" style={{ gap: 8, alignItems: "stretch" }}>
        {helpAction}
        <button type="button" style={cartChip} onClick={handleAdd} aria-label="หยิบใส่ตะกร้า">
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
