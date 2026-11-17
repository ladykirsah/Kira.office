import { addProductRoute } from "./appRoutes";

/**
 * Old back-office addresses (bookmarks, home-screen icons, links in LINE) jump to the page that
 * replaced them — plan 8.6, owner 16 Nov 2026 (*"no import product just add new product page flow
 * only. agree on terms → ตั้งค่าอะไหล่"*). Anything else unknown still shows ไม่มีหน้านี้ในแอป.
 */

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

/** Old pages with no page of that name here, and where each one lives now. */
const MOVED: Readonly<Record<string, string>> = {
  "/me": "/profile",
  "/settings/warranty": "/settings/attributes",
  "/settings/staff/salary": "/settings/staff?tab=pay",
  "/settings/staff/days-off": "/settings/staff?tab=off",
  "/settings/staff/activity": "/settings/staff?tab=history",
  "/login": "/sign-in",
  "/recover": "/sign-in",
  "/import": "/products/new",
  "/terms": "/settings/attributes",
};

export function movedAddress(pathname: string, params: Params): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (Object.hasOwn(MOVED, path)) return MOVED[path];
  // Old links that named one thing in the query: the car (customers?plate=) and the code to add.
  const plate = one(params.plate).trim();
  if (path === "/customers" && plate) return `/customers/${encodeURIComponent(plate)}`;
  const ref = one(params.ref).trim();
  if (path === "/products/new" && ref && !one(params.code)) return addProductRoute(ref);
  return null;
}

/** A segment like `[plate]` or `[...route]` names a part of the path, not a query value. */
const routeParam = (segment: string): string | null =>
  /^\[(?:\.\.\.)?(.+)\]$/.exec(segment)?.[1] ?? null;

/** The page's own address with its own query (a tab, a filter), to come back to after the PIN. */
export function addressOf(pathname: string, segments: readonly string[], params: Params): string {
  const inPath = new Set(segments.map(routeParam).filter((n): n is string => n !== null));
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (inPath.has(key)) continue;
    for (const v of Array.isArray(value) ? value : [value])
      if (v !== undefined) query.append(key, v);
  }
  const q = query.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/** One leading slash and nothing that could lead off this app: no `//`, no `\`. */
const APP_PAGE = /^\/(?![/\\])[^\\]*$/;
const hasLineBreakOrTab = (s: string): boolean => [...s].some((c) => c.charCodeAt(0) < 0x20);

/** Where the sign-in may send someone back to, or null for หน้าหลัก. */
export function returnPath(to: unknown): string | null {
  const path = Array.isArray(to) ? to[0] : to;
  if (typeof path !== "string" || path === "/") return null;
  if (!APP_PAGE.test(path) || hasLineBreakOrTab(path)) return null;
  return /^\/sign-in(?:[/?]|$)/.test(path) ? null : path;
}

/**
 * The PIN screen for a page opened while signed out. It remembers the page, so a bookmark (the PIN
 * is asked on every open) lands where it pointed — but not after signing out on purpose, so the
 * next person starts at หน้าหลัก.
 */
export function signInAddress(here: string, signedOutOnPurpose: boolean): string {
  const back = signedOutOnPurpose ? null : returnPath(here);
  return back ? `/sign-in?to=${encodeURIComponent(back)}` : "/sign-in";
}
