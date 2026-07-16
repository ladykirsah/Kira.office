"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Full-bleed site footer, rendered as a sibling of <main> in the root layout so its dark background
 * spans the whole width. Shown on the HOME page only — usePathname resolves during SSR, so inner
 * pages never render it (no flash, no hydration mismatch). Privacy/shipping links remain reachable
 * from the home footer.
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <footer style={{ background: "var(--footer-bg)", color: "var(--footer-text)" }}>
      <div className="wrap" style={{ padding: "28px 16px", fontSize: 14 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            fontStyle: "italic",
            letterSpacing: "-0.02em",
            color: "var(--white)",
            marginBottom: 6,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Air
          <span
            style={{
              color: "var(--brand)",
              fontSize: "1.25em",
              fontWeight: 900,
              display: "inline-block",
              transform: "rotate(-8deg)",
              margin: "0 0.02em",
            }}
          >
            +
          </span>
          Plus
        </div>
        <p style={{ margin: "0 0 12px" }}>
          อะไหล่แอร์รถยนต์ ของแท้ ส่งไว — ดำเนินการโดย Den Air Service
          (จดทะเบียนนิติบุคคลในประเทศไทย)
        </p>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Link href="/">หน้าแรก</Link>
          <Link href="/products">สินค้า</Link>
          <Link href="/cart">ตะกร้า</Link>
          <Link href="/orders">ติดตามคำสั่งซื้อ</Link>
          <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
          <Link href="/info">การจัดส่งและการชำระเงิน</Link>
        </div>
      </div>
    </footer>
  );
}
