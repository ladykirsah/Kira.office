/**
 * The approved design guide's tokens (owner approved, 2026-10-26): Apple-style greys and the shop's
 * Racing Red. Red is for the one main button, links, the selected tab, switches and the ✓ confirm
 * circle — nowhere else. Status is a coloured icon with plain words beside it, never coloured words.
 */
export const LIGHT = {
  bg: "#F2F2F7",
  surface: "#FFFFFF",
  border: "#E5E5EA",
  hover: "#E9E9EE",
  text: "#000000",
  textMuted: "#8A8A8E",
  textFaint: "#C7C7CC",
  primary: "#D7191F",
  primaryPressed: "#A30F14",
  primarySoft: "#FDECEC",
  button: "#D7191F",
  danger: "#B3121A",
  dangerSoft: "#FDECEC",
  dangerBorder: "#F2B8B5",
  codeBg: "#E9E9EE",
  onPrimary: "#FFFFFF",
  graphite: "#2C3036",
  glass: "rgba(255,255,255,0.86)",
  glassLine: "rgba(0,0,0,0.06)",
  tabOn: "rgba(0,0,0,0.06)",
  segBg: "rgba(118,118,128,0.12)",
  segOn: "#FFFFFF",
  scrim: "rgba(0,0,0,0.32)",
  success: "#18712F",
  waiting: "#9A5B00",
  toShip: "#0A5FC2",
};

export type Theme = typeof LIGHT;

export const DARK: Theme = {
  bg: "#000000",
  surface: "#1C1C1E",
  border: "#38383A",
  hover: "#2C2C2E",
  text: "#FFFFFF",
  textMuted: "#98989F",
  textFaint: "#5A5A5F",
  primary: "#FF5A4E",
  primaryPressed: "#D7191F",
  primarySoft: "#3A1716",
  button: "#D7191F",
  danger: "#FF6961",
  dangerSoft: "#3A1716",
  dangerBorder: "#6E2B28",
  codeBg: "#2C2C2E",
  onPrimary: "#FFFFFF",
  graphite: "#2C3036",
  glass: "rgba(44,44,46,0.82)",
  glassLine: "rgba(255,255,255,0.10)",
  tabOn: "rgba(255,255,255,0.10)",
  segBg: "rgba(118,118,128,0.24)",
  segOn: "#636366",
  scrim: "rgba(0,0,0,0.5)",
  success: "#32D74B",
  waiting: "#FFB340",
  toShip: "#64A8FF",
};

/** The guide's type scale. At most four of these on one screen. */
export const TYPE = {
  largeTitle: { fontSize: 34, lineHeight: 44, fontWeight: "700", letterSpacing: -0.4 },
  title1: { fontSize: 28, lineHeight: 35, fontWeight: "700" },
  title2: { fontSize: 22, lineHeight: 29, fontWeight: "700" },
  headline: { fontSize: 17, lineHeight: 24, fontWeight: "600" },
  body: { fontSize: 17, lineHeight: 24 },
  subhead: { fontSize: 15, lineHeight: 21 },
  footnote: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
} as const;

/** The only gaps the guide allows: 8 within a group, 28 between groups, 16 at the screen edge. */
export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const RADIUS = { card: 20, sheet: 38, field: 12, thumb: 12 } as const;

/** Sidebar 232px + content floor 510px = 742: below it the phone layout takes over, as on the web. */
export const PHONE_MAX_WIDTH = 741;
