"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cartCount, useCart } from "@/lib/cart";
import { productShareTitle, shareOrCopy } from "@/lib/share";

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

  // Does the back arrow have a real in-app page to return to? This component lives in the root layout,
  // so it mounts once; we pin the session's entry path and its starting history length. The shopper
  // "can go back" once EITHER the path differs from the entry OR the history stack has grown past its
  // start (a push happened) — both mean router.back() lands on an in-app page. A product page opened
  // cold from a LINE/Google deep link satisfies neither, so its arrow goes HOME instead of dead-ending
  // on history.back(). (Comparing the entry PATH alone was too fragile: it fired the home fallback
  // whenever the shopper legitimately returned to a URL whose path matched the session's entry.)
  const entryPath = useRef(pathname);
  const startLen = useRef<number | null>(null);
  if (startLen.current === null && typeof window !== "undefined") {
    startLen.current = window.history.length;
  }
  const goBack = () => {
    const grew =
      typeof window !== "undefined" &&
      startLen.current !== null &&
      history.length > startLen.current;
    if (grew || pathname !== entryPath.current) router.back();
    else router.push("/");
  };

  // Share lives only on a product detail page ("/products/<id>", not the "/products" list) — it sends
  // THIS product's link. Toast state gives the copy fallback a visible confirmation (phones with the
  // native share sheet never see it). Browser-only APIs are read inside the handler, never at render.
  const isProductPage = pathname.startsWith("/products/");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };
  const onShare = async () => {
    const outcome = await shareOrCopy(navigator, {
      title: productShareTitle(document.title),
      url: window.location.href,
    });
    if (outcome === "copied") flash("คัดลอกลิงก์แล้ว", true);
    else if (outcome === "unsupported") flash("ไม่สามารถแชร์ได้ ลองอีกครั้ง", false);
    // "shared" / "cancelled" → the OS share sheet already handled it; no toast.
  };

  if (pathname === "/" || pathname === "/cart" || pathname === "/search") return null;

  return (
    <>
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
            onClick={goBack}
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

          <Link href="/search" aria-label="ค้นหาสินค้า" className="hdr-tap" style={iconBtn(0)}>
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

          {isProductPage && (
            <button
              type="button"
              onClick={() => void onShare()}
              aria-label="แชร์สินค้า"
              className="hdr-tap"
              style={iconBtn(0)}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
            </button>
          )}

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

      {toast && (
        <div className="ap-toast" role="status" aria-live="polite">
          {toast.ok && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {toast.msg}
        </div>
      )}
    </>
  );
}
