"use client";

import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart";
import { Icon } from "@/components/Icon";

/** Header cart link with a live line-count badge (updates on any cart change, incl. other tabs). */
export function CartBadge() {
  const lines = useCart();
  const count = cartCount(lines);
  return (
    <Link href="/cart" aria-label={`ตะกร้าสินค้า (${count} ชิ้น)`} className="hdr-tap">
      <span style={{ position: "relative", display: "inline-flex" }}>
        <Icon name="cart" size={24} />
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -9,
              minWidth: 18,
              height: 18,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--brand-blue)",
              color: "var(--white)",
              fontSize: 11,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid var(--white)",
            }}
          >
            {count}
          </span>
        )}
      </span>
    </Link>
  );
}
