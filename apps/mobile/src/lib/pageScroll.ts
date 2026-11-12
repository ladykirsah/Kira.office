/**
 * How the phone page scrolls on the website (owner, 7 Nov 2026, "B · Full slide-under"). iPhone
 * Safari shows a page under its clock and its bottom bar, and shrinks that bar, only when the whole
 * page scrolls — not a box inside it. So the website's phone frame lets the page itself scroll, and
 * pins its tab bar and buttons to the screen. No screen code here.
 */

/** The website on a phone scrolls as one page; the computer (sidebar) and the app keep their own. */
export const scrollsWithPage = (os: string, phone: boolean): boolean => os === "web" && phone;

/** What holds the tab bar and pinned buttons in place while the page scrolls under them. */
export const pinnedPosition = (os: string): "fixed" | "absolute" =>
  os === "web" ? "fixed" : "absolute";
