/**
 * "มีเวอร์ชันใหม่ · แตะเพื่ออัปเดต" (owner approved the drawing, 4 Nov 2026). A page left open keeps
 * running the version it loaded; the website's built page names its app bundle by a hash that changes
 * with every release. Same bundle = same version. Anything unclear (the dev server, a broken reply)
 * shows no bar.
 */

const ENTRY = /\/_expo\/static\/js\/web\/entry-[0-9a-f]+\.js/i;

/** The app bundle a page from the website loads, or null when it names none. */
export function entryScriptOf(html: string): string | null {
  return ENTRY.exec(html)?.[0] ?? null;
}

/** The app bundle among the open page's scripts (full addresses), as a path. */
export function runningEntry(srcs: readonly string[]): string | null {
  for (const src of srcs) {
    const hit = ENTRY.exec(src);
    if (hit) return hit[0];
  }
  return null;
}

export function hasNewVersion(running: string | null, liveHtml: string): boolean {
  const live = entryScriptOf(liveHtml);
  return running !== null && live !== null && live !== running;
}

/** How often an open app looks again; it also looks each time it comes back on screen. */
export const UPDATE_CHECK_MS = 5 * 60 * 1000;
