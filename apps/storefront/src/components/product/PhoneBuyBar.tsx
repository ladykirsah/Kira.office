"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart, type CartLine } from "@/lib/cart";
import { track } from "@/lib/track";
import { LINE_OA_URL } from "@/lib/links";
import { Icon } from "@/components/Icon";
import { useProductSizes } from "@/components/ProductSizes";

/**
 * The phone product page's bottom bar (board 3): ถามช่าง (LINE) · ใส่ตะกร้า · red ซื้อเลย — one word, no
 * price (rulebook: buttons carry no amount). ใส่ตะกร้า says เพิ่มลงตะกร้าแล้ว; ซื้อเลย goes to checkout.
 * A product with sizes opens the size sheet first (board 3b.5). Sold out → ถามช่าง · สินค้าหมด.
 * Prices are display-only; checkout re-prices from the database.
 */
export function PhoneBuyBar({ line, onHand }: { line: Omit<CartLine, "qty">; onHand: number }) {
  const router = useRouter();
  const sizes = useProductSizes();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const add = () => {
    track("add_to_cart", line.productId);
    addToCart(line, 1);
  };
  const toCart = () => {
    if (sizes.sized) return sizes.open("cart");
    add();
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1600);
  };
  const buyNow = () => {
    if (sizes.sized) return sizes.open("buy");
    add();
    router.push("/checkout");
  };

  const ask = (
    <a
      href={LINE_OA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="pp-bar-btn"
      aria-label="ถามช่างทาง LINE"
    >
      <Icon name="chat" size={22} />
      ถามช่าง
    </a>
  );

  return (
    <div className="pp-bar">
      {ask}
      <span className="pp-bar-sep" aria-hidden="true" />
      {onHand > 0 ? (
        <>
          <button type="button" className="pp-bar-btn" onClick={toCart}>
            <Icon name="cart" size={22} />
            ใส่ตะกร้า
          </button>
          <button type="button" className="pp-bar-buy" onClick={buyNow}>
            ซื้อเลย
          </button>
        </>
      ) : (
        <button type="button" className="pp-bar-buy" disabled>
          สินค้าหมด
        </button>
      )}
      {added && (
        <div className="ap-toast" role="status" aria-live="polite">
          <Icon name="check" size={15} />
          เพิ่มลงตะกร้าแล้ว
        </div>
      )}
    </div>
  );
}
