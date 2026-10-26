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

/** The round ☰ button beside the bar, which opens every other page. */
export const MENU_ICON = "M4 7h16M4 12h16M4 17h16";
