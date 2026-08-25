import type { StaffRole } from "@l-shopee/core";
import type { Phrase } from "@/lib/lang";

/**
 * The one description of the admin's navigation — used by the desktop sidebar and by the phone
 * menu (bottom bar + drawer), so the two can never drift apart.
 */

export interface NavLink {
  href: string;
  icon: string;
  /**
   * BOTH LANGUAGES, written here (owner, 2026-08-25). The menu is the one thing on every screen, so
   * it is where a half-translated app shows worst. Several are the owner's own words rather than a
   * translation — ทำบิล for Point of Sale, สินค้านายหน้า for Affiliate Promote — because the shop
   * already has a name for the thing and it is not the dictionary's.
   */
  label: Phrase;
  /** Shorter label for the phone's bottom bar, where a slot is ~97px wide. */
  short?: Phrase;
}

export interface NavGroup {
  section: Phrase;
  links: NavLink[];
}

/**
 * Grouped by the job each page does, not by which part of the codebase it lives in (owner's
 * grouping, 2026-08-03). The old sections split pages by area — "Scan here" sat under Catalog even
 * though it is a counter tool, and Settings was a single pile of nine pages doing three unrelated
 * jobs (shop setup, catalog structure, promotion). A page belongs where the work happens: the
 * things you touch with a customer in front of you, the things that describe stock, the things
 * that promote the AirPlus shop, and the things you set once and leave alone.
 *
 * Note that the four /settings/* marketing pages keep their URLs — only their place in the menu
 * moved, so every existing link and bookmark still lands.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    section: { th: "งานประจำวัน", en: "Daily Uses" },
    links: [
      {
        href: "/scan",
        icon: "📷",
        label: { th: "สแกน", en: "Scan here" },
        short: { th: "สแกน", en: "Scan" },
      },
      {
        href: "/orders",
        icon: "🧾",
        label: { th: "ออเดอร์ AirPlus", en: "AirPlus Orders" },
        short: { th: "ออเดอร์", en: "Orders" },
      },
      {
        href: "/pos",
        icon: "🛒",
        label: { th: "ทำบิล", en: "Point of Sale" },
        short: { th: "ทำบิล", en: "POS" },
      },
      { href: "/payment", icon: "💸", label: { th: "การชำระเงิน", en: "Payment" } },
      { href: "/customers", icon: "👥", label: { th: "ลูกค้า", en: "Customers" } },
    ],
  },
  {
    section: { th: "สต็อก", en: "Stock" },
    links: [
      { href: "/products", icon: "📦", label: { th: "สินค้า", en: "Products" } },
      { href: "/products/new", icon: "➕", label: { th: "เพิ่มสินค้า", en: "Add product" } },
      { href: "/barcodes", icon: "🏷️", label: { th: "บาร์โค้ด", en: "Barcodes" } },
      { href: "/stock", icon: "📊", label: { th: "รายการสต็อก", en: "Stock movements" } },
      // /import (product CSV) is deliberately NOT listed: it only carries product_ref, name and
      // description, so every row still needs opening by hand — the owner adds products through
      // Add product instead (2026-07-29). The page still works if a bulk supplier list ever needs
      // loading; it just no longer competes for room in the daily menu.
    ],
  },
  {
    section: { th: "การตลาด AirPlus", en: "AirPlus Marketing" },
    links: [
      // First in the section on purpose: you read what the shop did, then reach for the levers
      // below it. Shopee's own Business Insights sits the same way relative to its marketing tools.
      { href: "/insights", icon: "📈", label: { th: "ภาพรวม AirPlus", en: "Insight" } },
      {
        href: "/settings/affiliate-items",
        icon: "🤝",
        label: { th: "สินค้านายหน้า", en: "Affiliate Promote" },
      },
      { href: "/settings/banners", icon: "🖼️", label: { th: "แบนเนอร์", en: "Banners" } },
      { href: "/settings/coupons", icon: "🎟️", label: { th: "คูปอง", en: "Coupons" } },
      { href: "/settings/campaigns", icon: "⚡", label: { th: "แฟลชเซล", en: "Flash sales" } },
      // There is no "Affiliate income" page any more. It was a stub that always printed ฿0: Shopee
      // pays affiliate commission through their own portal and there is no API into it, so the
      // figure could never become real. The honest number we DO own — outbound clicks — already
      // lives on Affiliate Promote (2026-07-29).
    ],
  },
  {
    section: { th: "การจัดการทั่วไป", en: "Overall management" },
    links: [
      { href: "/settings/shop", icon: "🏪", label: { th: "ข้อมูลร้าน", en: "Shop info" } },
      // Next to Shop info (owner, 2026-08-04): the shop and the people in it are the same errand.
      // Super admin only.
      { href: "/settings/staff", icon: "👤", label: { th: "พนักงาน", en: "Staff" } },
      { href: "/sales", icon: "💰", label: { th: "การเงิน", en: "Finance" } },
      {
        href: "/settings/services",
        icon: "🔧",
        label: { th: "ตั้งค่าบริการ", en: "Service Setup" },
      },
      // Warranty used to be its own entry; it now lives on the Product categories card on Part
      // setup, so a category is created complete (title + photo + warranty) in one place.
      {
        href: "/settings/attributes",
        icon: "🧩",
        label: { th: "ตั้งค่าอะไหล่", en: "Part setup" },
      },
      {
        href: "/settings/car-fitment",
        icon: "🚗",
        label: { th: "รุ่นรถที่ใช้ได้", en: "Car fitment" },
      },
      { href: "/terms", icon: "📝", label: { th: "เงื่อนไข", en: "Terms" } },
    ],
  },
];

/**
 * The menu as one role sees it.
 *
 * HIDDEN MEANS ABSENT, not greyed out (owner, 2026-08-03) — a disabled row still tells a mechanic
 * that a Finance page exists. And this is only the MENU: every rule below is enforced again in the
 * API, because a link nobody can see is not a permission.
 *
 * A section that loses all its links disappears with them; a bare "Overall management" heading with
 * nothing under it looks like a bug.
 */
const HIDDEN_FROM: Record<StaffRole, ReadonlySet<string>> = {
  super_admin: new Set(),
  // An admin runs the shop but not the books, and never the people. Insight is withheld for the
  // same reason as Finance rather than a new one: its two headline tiles are profit and margin, so
  // showing it would hand over exactly the numbers /sales exists to keep. If the owner would rather
  // an admin could read the traffic half, the fix is to split the page, not to open this one.
  admin: new Set(["/sales", "/settings/staff", "/insights"]),
  // A mechanic gets the counter and the stock they touch. No catalogue editing (Add product,
  // Barcodes), no marketing, no settings, no money.
  mechanic: new Set([
    "/products/new",
    "/insights",
    "/barcodes",
    "/settings/affiliate-items",
    "/settings/banners",
    "/settings/coupons",
    "/settings/campaigns",
    "/settings/shop",
    "/sales",
    "/settings/services",
    "/settings/attributes",
    "/settings/car-fitment",
    "/terms",
    "/settings/staff",
  ]),
};

export function navGroupsFor(role: StaffRole): NavGroup[] {
  const hidden = HIDDEN_FROM[role];
  return NAV_GROUPS.map((g) => ({
    section: g.section,
    links: g.links.filter((l) => !hidden.has(l.href)),
  })).filter((g) => g.links.length > 0);
}

const byHref = new Map(NAV_GROUPS.flatMap((g) => g.links).map((l) => [l.href, l]));

/**
 * The four pages that get a permanent slot in the phone's bottom bar, in the owner's order
 * (2026-07-29): what they reach for every day standing at the counter. Everything else is one tap
 * away behind ☰ — there is deliberately no "More" tab.
 */
export const PRIMARY_TABS: NavLink[] = ["/scan", "/customers", "/pos", "/payment"].map(
  (href) => byHref.get(href) as NavLink,
);

/**
 * Which menu link the current path belongs to. The most specific match wins, so a sub-route
 * (/customers/1กก) highlights its parent without a shorter sibling (/products vs /products/new)
 * also lighting up.
 */
export function activeHref(path: string): string | undefined {
  return [...byHref.keys()]
    .filter((h) => path === h || path.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** Scroll movement smaller than this is ignored, so the bar doesn't flicker. */
const SCROLL_THRESHOLD = 8;
/** Within this distance of the top the bar is always shown, whatever the direction. */
const TOP_ZONE = 24;

/**
 * Whether the bottom bar should be visible after a scroll: hidden while scrolling down a long
 * list, back the moment you scroll up, and always present near the top of the page.
 */
export function nextBarVisible(prev: { y: number; visible: boolean }, y: number): boolean {
  if (y <= TOP_ZONE) return true;
  if (y > prev.y + SCROLL_THRESHOLD) return false;
  if (y < prev.y - SCROLL_THRESHOLD) return true;
  return prev.visible;
}
