/**
 * The bottom bar's line icons, drawn on a 24-unit grid with a 1.9 stroke — the same shapes as the
 * approved design guide (owner, 2026-10-26). One SVG path each, keyed by the menu link they stand for.
 */
export const TAB_ICONS: Record<string, string> = {
  "/scan":
    "M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16M7.5 8v8M10.5 8v8M13.5 8v8M16.5 8v8",
  "/customers":
    "M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 20v-1.5a4 4 0 0 0-3-3.9M15.5 4.1a3.5 3.5 0 0 1 0 6.8",
  "/pos": "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  "/payment":
    "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M6 12h.01M18 12h.01",
};

/**
 * The ☰ menu's line icons (design C, 4 Nov 2026): every page gets one in the bottom bar's style
 * instead of an emoji. The bar's four reuse their own shapes.
 */
export const PAGE_ICONS: Record<string, string> = {
  ...TAB_ICONS,
  "/": "M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5",
  "/orders": "M3 13l2.5-8h13L21 13v6H3zM3 13h5l1.5 2.5h5L16 13h5",
  "/products": "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  "/products/new": "M12 5v14M5 12h14",
  "/barcodes":
    "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3",
  "/stock": "M4 20V10M10 20V4M16 20v-7M2 20h20",
  "/insights": "M3 3v18h18M7 15l4-4 3 3 6-6",
  "/settings/affiliate-items":
    "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  "/settings/banners": "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6",
  "/settings/coupons": "M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM10 6v12",
  "/settings/campaigns": "M13 2L4 14h7l-1 8 9-12h-7z",
  "/settings/shop": "M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6",
  "/settings/staff": "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  "/sales": "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  "/settings/services":
    "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z",
  "/settings/attributes": "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  "/settings/car-fitment": "M3 17v-5l2-5h14l2 5v5zM3 17h18M7 17v2M17 17v2M7 13h.01M17 13h.01",
};

/** The round ☰ button beside the bar, which opens every other page. */
export const MENU_ICON = "M4 7h16M4 12h16M4 17h16";
