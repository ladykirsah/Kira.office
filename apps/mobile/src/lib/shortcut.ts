import { isLocalApi } from "./config";

const HOME_OF_THE_SHORTCUT = "/scan";
/** A page of this app: one leading slash, then plain path characters — never another site. */
const APP_PAGE = /^\/(?!\/)[A-Za-z0-9\-/]*$/;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The owner's shortcut into the practice copy (2026-10-27): a link to sign-in with `?practice=1`
 * signs in with no PIN and lands on Scan (or the page in `to`). Only when the app talks to a server
 * on this computer — the real shop never offers it, and its server has no practice sign-in either.
 */
export function shortcutTarget(
  apiBase: string,
  params: Record<string, string | string[] | undefined>,
): string | null {
  if (!isLocalApi(apiBase) || one(params.practice) !== "1") return null;
  const to = one(params.to);
  return to && APP_PAGE.test(to) ? to : HOME_OF_THE_SHORTCUT;
}
