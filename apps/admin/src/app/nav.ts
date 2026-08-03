/**
 * The one description of the admin's navigation — used by the desktop sidebar and by the phone
 * menu (bottom bar + drawer), so the two can never drift apart.
 */

export interface NavLink {
  href: string;
  icon: string;
  label: string;
  /** Shorter label for the phone's bottom bar, where a slot is ~97px wide. */
  short?: string;
}

export interface NavGroup {
  section: string;
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
    section: "Daily Uses",
    links: [
      { href: "/scan", icon: "📷", label: "Scan here", short: "Scan" },
      { href: "/orders", icon: "🧾", label: "AirPlus Orders", short: "Orders" },
      { href: "/pos", icon: "🛒", label: "Point of Sale", short: "POS" },
      { href: "/payment", icon: "💸", label: "Payment" },
      { href: "/customers", icon: "👥", label: "Customers" },
    ],
  },
  {
    section: "Stock",
    links: [
      { href: "/products", icon: "📦", label: "Products" },
      { href: "/products/new", icon: "➕", label: "Add product" },
      { href: "/barcodes", icon: "🏷️", label: "Barcodes" },
      { href: "/stock", icon: "📊", label: "Stock movements" },
      // /import (product CSV) is deliberately NOT listed: it only carries product_ref, name and
      // description, so every row still needs opening by hand — the owner adds products through
      // Add product instead (2026-07-29). The page still works if a bulk supplier list ever needs
      // loading; it just no longer competes for room in the daily menu.
    ],
  },
  {
    section: "AirPlus Marketing",
    links: [
      { href: "/settings/affiliate-items", icon: "🤝", label: "Affiliate Promote" },
      { href: "/settings/banners", icon: "🖼️", label: "Banners" },
      { href: "/settings/coupons", icon: "🎟️", label: "Coupons" },
      { href: "/settings/campaigns", icon: "⚡", label: "Flash sales" },
      // There is no "Affiliate income" page any more. It was a stub that always printed ฿0: Shopee
      // pays affiliate commission through their own portal and there is no API into it, so the
      // figure could never become real. The honest number we DO own — outbound clicks — already
      // lives on Affiliate Promote (2026-07-29).
    ],
  },
  {
    section: "Overall management",
    links: [
      { href: "/settings/shop", icon: "🏪", label: "Shop info" },
      { href: "/sales", icon: "💰", label: "Finance" },
      { href: "/settings/services", icon: "🔧", label: "Service Setup" },
      // Warranty used to be its own entry; it now lives on the Product categories card on Part
      // setup, so a category is created complete (title + photo + warranty) in one place.
      { href: "/settings/attributes", icon: "🧩", label: "Part setup" },
      { href: "/settings/car-fitment", icon: "🚗", label: "Car fitment" },
      { href: "/terms", icon: "📝", label: "Terms" },
    ],
  },
];

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
