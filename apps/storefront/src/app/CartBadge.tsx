"use client";

import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart";

/** Header cart link with a live line-count badge (updates on any cart change, incl. other tabs). */
export function CartBadge() {
  const lines = useCart();
  const count = cartCount(lines);
  return (
    <Link href="/cart" aria-label={`ตะกร้าสินค้า (${count} ชิ้น)`} className="hdr-tap">
      <span style={{ position: "relative", display: "inline-flex" }}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="21" r="1.4" />
          <circle cx="20" cy="21" r="1.4" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
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
              background: "var(--brand-deep)",
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
