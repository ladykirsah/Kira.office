/**
 * The dashboard's "Go to" grid — shortcuts to the pages the owner opens most.
 *
 * It lives here rather than inside page.tsx so it can be tested: this list is a hand-kept copy of
 * destinations that also appear in the menu, and a copy with no test rots. "Shopee CSV import" sat
 * on the Orders card long after the Shopee import was gone (owner, 2026-08-03) precisely because
 * nothing tied the two together. dashboardCards.test.ts now does.
 */
export interface DashboardCard {
  href: string;
  icon: string;
  title: string;
  desc: string;
}

export const DASHBOARD_CARDS: DashboardCard[] = [
  { href: "/products", icon: "📦", title: "Products", desc: "Catalog, images, edit" },
  { href: "/barcodes", icon: "🏷️", title: "Barcodes", desc: "Generate & print" },
  { href: "/pos", icon: "🛒", title: "Point of Sale", desc: "Barcode selling (works offline)" },
  { href: "/sales", icon: "💰", title: "Finance", desc: "Totals, VAT, profit, refunds" },
  { href: "/orders", icon: "🧾", title: "AirPlus Orders", desc: "Track, ship, refund" },
  { href: "/terms", icon: "📝", title: "Terms", desc: "Thai T&C editor" },
];
