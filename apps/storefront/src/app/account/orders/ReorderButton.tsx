"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart";
import { imgUrl } from "@/lib/img";

/** One order line at CURRENT price (re-priced server-side) — never the historical order price. */
export interface ReorderLine {
  variantId: string;
  productId: string;
  name: string;
  productRef: string;
  priceSatang: number;
  imageKey: string | null;
  qty: number;
}

/** Adds every line of a past order back into the cart, then heads to /cart. */
export function ReorderButton({ lines }: { lines: ReorderLine[] }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);

  function reorder() {
    if (added) return;
    for (const { qty, ...line } of lines) addToCart(line, qty);
    setAdded(true);
    setTimeout(() => router.push("/cart"), 600);
  }

  return (
    <button
      type="button"
      className="btn"
      onClick={reorder}
      disabled={added}
      style={added ? { color: "var(--ok)", borderColor: "var(--ok)" } : undefined}
    >
      {added ? "เพิ่มลงตะกร้าแล้ว ✓" : "สั่งซื้ออีกครั้ง"}
    </button>
  );
}

/** Line thumbnail with graceful placeholder (client-side onError — dev images 404). */
export function OrderLineThumb({ imageKey, name }: { imageKey: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!imageKey || failed) {
    return (
      <div className="frame" style={{ width: 48, height: 48, flexShrink: 0 }}>
        <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1, color: "var(--brand)" }}>
          ✦
        </span>
      </div>
    );
  }
  return (
    <div className="frame" style={{ width: 48, height: 48, flexShrink: 0 }}>
      <img src={imgUrl(imageKey)} alt={name} onError={() => setFailed(true)} />
    </div>
  );
}
