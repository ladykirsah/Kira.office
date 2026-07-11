"use client";

import { usePathname, useRouter } from "next/navigation";
import { cartCount, useCart } from "@/lib/cart";

/**
 * Cart-only header (owner-approved "Design 1"): a brand-orange sticky app bar that REPLACES the
 * global header on /cart — back arrow (browser back) + centered "ตะกร้าสินค้า (n)" title. Focused
 * on the cart, no wordmark/search/login. Shown only on /cart; the in-page <h1> is dropped so the
 * title lives here. usePathname resolves during SSR → no flash.
 */
export function CartHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const count = cartCount(useCart());
  if (pathname !== "/cart") return null;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--brand)",
        color: "var(--white)",
      }}
    >
      <div
        className="wrap"
        style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 52 }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="ย้อนกลับ"
          className="hdr-tap"
          style={{
            width: 40,
            height: 40,
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -8,
            background: "transparent",
            border: "none",
            borderRadius: 999,
            color: "var(--white)",
            cursor: "pointer",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.01em",
          }}
        >
          ตะกร้าสินค้า
          {count > 0 && (
            <span style={{ fontWeight: 600, opacity: 0.92, marginLeft: 3 }}>({count})</span>
          )}
        </div>
        {/* spacer mirrors the 40px back button so the title stays optically centered */}
        <span style={{ width: 40, flex: "0 0 auto" }} aria-hidden="true" />
      </div>
    </header>
  );
}
