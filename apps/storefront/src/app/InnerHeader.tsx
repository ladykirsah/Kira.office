"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cartCount, useCart } from "@/lib/cart";
import { productShareTitle, shareOrCopy } from "@/lib/share";
import { Icon } from "@/components/Icon";

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
  "/terms": "ข้อกำหนดการใช้งาน",
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
  // A robust "have we navigated in-app this tab-session?" flag. The mount-pinned refs above are
  // fragile: a hard refresh or a cold deep-link REMOUNTS this header and resets them, so an in-app
  // page looks like the session entry and the arrow wrongly goes HOME. sessionStorage survives
  // remounts/refreshes and is empty only on a genuinely fresh tab, so once set it reliably means
  // router.back() lands on a real in-app page. The refs stay as a fallback when storage is blocked.
  useEffect(() => {
    if (pathname !== entryPath.current) {
      try {
        sessionStorage.setItem("ap:navigated", "1");
      } catch {
        /* storage unavailable — the ref fallback in goBack still covers the common case */
      }
    }
  }, [pathname]);
  const goBack = () => {
    let navigated = false;
    try {
      navigated = sessionStorage.getItem("ap:navigated") === "1";
    } catch {
      /* storage unavailable */
    }
    const grew =
      typeof window !== "undefined" &&
      startLen.current !== null &&
      history.length > startLen.current;
    if (navigated || grew || pathname !== entryPath.current) router.back();
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
            <Icon name="back" size={24} />
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
            <Icon name="search" size={22} />
          </Link>

          {isProductPage && (
            <button
              type="button"
              onClick={() => void onShare()}
              aria-label="แชร์สินค้า"
              className="hdr-tap"
              style={iconBtn(0)}
            >
              <Icon name="share" size={21} />
            </button>
          )}

          <Link
            href="/cart"
            aria-label={`ตะกร้าสินค้า (${count} ชิ้น)`}
            className="hdr-tap"
            style={iconBtn(0)}
          >
            <Icon name="cart" size={24} />
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
          {toast.ok && <Icon name="check" size={15} />}
          {toast.msg}
        </div>
      )}
    </>
  );
}
