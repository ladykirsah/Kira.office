"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountNav } from "./AccountNav";
import { CartBadge } from "./CartBadge";
import { SearchBox } from "@/components/SearchBox";

/**
 * Global storefront header: brand-orange band, row 1 = wordmark + cart + profile, row 2 = the
 * persistent search bar. Shown ONLY on the home page — the cart uses CartHeader and every other
 * route uses InnerHeader (back + title). usePathname resolves during SSR → no flash.
 */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

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
      <div className="wrap" style={{ paddingTop: 16, paddingBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 40,
          }}
        >
          <Link
            href="/"
            aria-label="AirPlus หน้าแรก"
            style={{
              fontSize: 22,
              fontWeight: 900,
              fontStyle: "italic",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              display: "inline-flex",
              alignItems: "center",
              color: "var(--white)",
            }}
          >
            Air
            <span
              style={{
                color: "var(--gray-dark)",
                fontSize: "1.25em",
                fontWeight: 900,
                display: "inline-block",
                transform: "rotate(-8deg)",
                margin: "0 0.02em",
                lineHeight: 1,
              }}
            >
              +
            </span>
            Plus
          </Link>
          <nav style={{ display: "flex", alignItems: "center", gap: 2, color: "var(--white)" }}>
            <CartBadge />
            <AccountNav />
          </nav>
        </div>
        <div style={{ marginTop: 10 }}>
          <SearchBox />
        </div>
      </div>
    </header>
  );
}
