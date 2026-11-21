/**
 * TeamPit's font: IBM Plex Sans Thai (owner, 20 Nov 2026, plan 11.1: "B + IBM Plex"), the same on every
 * phone and computer. The web page loads its 400 / 600 / 700 weights from /fonts (public/index.html);
 * until they arrive, the phone's own font shows. The TeamPit name keeps Space Grotesk (brandFont.ts). The
 * printed papers use it too (plan 11.6, owner "papers A"). appFont.test.ts fails on any text style without it.
 */
export const APP_FONT =
  '"IBM Plex Sans Thai", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Spread first into a text style that sets its own size: `{ ...APP_FONT_STYLE, fontSize: 13 }`. */
export const APP_FONT_STYLE = { fontFamily: APP_FONT } as const;

/**
 * Before a paper becomes a picture (bill, label sheet, parcel label): all three weights are in, or the
 * picture would fall back to the phone's font for a weight the screen hadn't used yet.
 */
export async function appFontLoaded(): Promise<void> {
  await Promise.all(
    [400, 600, 700].map((weight) => document.fonts.load(`${weight} 16px "IBM Plex Sans Thai"`)),
  );
}
