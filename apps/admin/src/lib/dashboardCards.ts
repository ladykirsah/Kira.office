/**
 * The dashboard's "Go to" grid — shortcuts to the pages the owner opens most.
 *
 * It lives here rather than inside page.tsx so it can be tested: this list is a hand-kept copy of
 * destinations that also appear in the menu, and a copy with no test rots. "Shopee CSV import" sat
 * on the Orders card long after the Shopee import was gone (owner, 2026-08-03) precisely because
 * nothing tied the two together. dashboardCards.test.ts now does.
 *
 * The titles are BOTH LANGUAGES and must match the menu's on both sides (owner, 2026-08-25) — the
 * test checks the whole phrase, not just the English, so translating one and forgetting the other
 * is caught the same way a stale title was.
 */
import type { Phrase } from "./lang";

export interface DashboardCard {
  href: string;
  icon: string;
  title: Phrase;
  desc: Phrase;
}

export const DASHBOARD_CARDS: DashboardCard[] = [
  {
    href: "/products",
    icon: "📦",
    title: { th: "สินค้า", en: "Products" },
    desc: { th: "แคตตาล็อก รูป แก้ไข", en: "Catalog, images, edit" },
  },
  {
    href: "/barcodes",
    icon: "🏷️",
    title: { th: "บาร์โค้ด", en: "Barcodes" },
    desc: { th: "สร้างและพิมพ์", en: "Generate & print" },
  },
  {
    href: "/pos",
    icon: "🛒",
    title: { th: "ทำบิล", en: "Point of Sale" },
    desc: { th: "ขายด้วยบาร์โค้ด (ใช้ออฟไลน์ได้)", en: "Barcode selling (works offline)" },
  },
  {
    href: "/sales",
    icon: "💰",
    title: { th: "การเงิน", en: "Finance" },
    desc: { th: "ยอดรวม ภาษี กำไร คืนเงิน", en: "Totals, VAT, profit, refunds" },
  },
  {
    href: "/orders",
    icon: "🧾",
    title: { th: "ออเดอร์ AirPlus", en: "AirPlus Orders" },
    desc: { th: "ติดตาม จัดส่ง คืนเงิน", en: "Track, ship, refund" },
  },
  {
    href: "/terms",
    icon: "📝",
    title: { th: "เงื่อนไข", en: "Terms" },
    desc: { th: "แก้ไขเงื่อนไขภาษาไทย", en: "Thai T&C editor" },
  },
];
