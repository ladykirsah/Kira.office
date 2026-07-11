"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cartCount, useCart } from "@/lib/cart";

/**
 * Shared inner-page header (owner-approved "Design 1"): a brand-orange sticky nav — back arrow
 * (browser back) + the page's title (left) + search & cart quick actions (right). Shown on every
 * route EXCEPT home (which keeps the full SiteHeader) and cart (its own CartHeader), so all three
 * headers partition the app with no overlap. usePathname resolves during SSR → no flash.
 */

/** Exact-path titles; dynamic routes fall back below. Keep in step with the page it names. */
const TITLES: Record<string, string> = {
  "/categories": "หมวดหมู่",
  "/brands": "ยี่ห้อรถ",
  "/products": "สินค้าทั้งหมด",
  "/orders": "ติดตามคำสั่งซื้อ",
  "/tools": "เครื่องมือช่าง",
  "/info": "การจัดส่ง & ชำระเงิน",
  "/privacy": "นโยบายความเป็นส่วนตัว",
  "/login": "เข้าสู่ระบบ",
  "/coupons": "คูปอง",
  "/account": "บัญชีของฉัน",
  "/account/orders": "ประวัติคำสั่งซื้อ",
  "/account/addresses": "ที่อยู่จัดส่ง",
  "/checkout": "ชำระเงิน",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/products/")) return "รายละเอียดสินค้า";
  if (pathname.startsWith("/orders/")) return "รายละเอียดคำสั่งซื้อ";
  return "AirPlus";
}

const iconBtn = (marginLeft = 0): React.CSSProperties => ({
  width: 40,
  height: 40,
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginLeft,
  background: "transparent",
  border: "none",
  borderRadius: 999,
  color: "var(--white)",
  cursor: "pointer",
  position: "relative",
});

export function InnerHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const count = cartCount(useCart());
  if (pathname === "/" || pathname === "/cart") return null;

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
          style={iconBtn(-8)}
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
            minWidth: 0,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            paddingLeft: 2,
          }}
        >
          {titleFor(pathname)}
        </div>

        <Link href="/products" aria-label="ค้นหาสินค้า" className="hdr-tap" style={iconBtn(0)}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4-4" />
          </svg>
        </Link>

        <Link
          href="/cart"
          aria-label={`ตะกร้าสินค้า (${count} ชิ้น)`}
          className="hdr-tap"
          style={iconBtn(0)}
        >
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
                top: 0,
                right: 0,
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
        </Link>
      </div>
    </header>
  );
}
