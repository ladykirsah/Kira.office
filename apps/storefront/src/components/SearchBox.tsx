import Link from "next/link";
import { Icon } from "@/components/Icon";

/**
 * Home search entry — a tappable bar that OPENS the dedicated /search page (recent searches, search
 * by car, suggested products), the Shopee pattern the owner asked for. Styled to look like the input
 * it replaces (magnifier + placeholder text); the real typing happens on /search. A plain link, so it
 * works without JS and never flashes the on-screen keyboard the way a focus-then-redirect input would.
 */
export function SearchBox() {
  return (
    <Link
      href="/search"
      role="search"
      aria-label="ค้นหาสินค้า"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 46,
        padding: "0 16px",
        borderRadius: 999,
        background: "var(--white)",
        boxShadow: "0 1px 4px rgba(55, 54, 54, 0.14)",
        color: "var(--gray-mid)",
        textDecoration: "none",
      }}
    >
      <Icon name="search" size={20} style={{ flex: "0 0 auto" }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        ค้นหาด้วยรุ่นรถ หรือชื่ออะไหล่ เช่น ตู้แอร์ Vigo
      </span>
    </Link>
  );
}
