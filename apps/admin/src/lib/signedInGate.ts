/**
 * Who may see the back office, decided by the only thing that actually knows.
 *
 * THE INCIDENT THIS EXISTS FOR (24 Aug 2026). `middleware.ts` gates every page on the session
 * COOKIE being present. It cannot do better — middleware has no database, so it cannot tell a live
 * token from a dead one. A cookie whose session had been revoked, had expired, or whose user had
 * been deleted therefore passed the gate, and the whole back office rendered for nobody at all:
 * empty corner where the name goes, no redirect, no message, no clue. The owner looked at a
 * normal-seeming screen and could not tell whether they were signed in as themselves, as somebody
 * else, or as no one.
 *
 * The truth is already fetched once per request: the root layout asks the API `/staff/me`. This
 * turns that answer into the decision the middleware could not make. The middleware stays the cheap
 * first pass; this is the one that is right.
 */

/** Request header the middleware stamps the pathname into, so the layout knows what it is drawing. */
export const GATED_PATH_HEADER = "x-kira-path";

/** Query flag telling the login page to explain why someone landed back on it. */
export const EXPIRED_PARAM = "expired";

/** The login page and anything beneath it — the one place a signed-out person must be able to reach. */
function isLoginPath(path: string): boolean {
  const bare = path.split("?")[0]!;
  return bare === "/login" || bare.startsWith("/login/");
}

/**
 * Must this request be sent to the sign-in page?
 *
 * `path` is null when the middleware did not handle the request — assets, and the login route
 * handlers. Those are not gated and must not be redirected: bouncing the sign-in endpoints would
 * make signing in impossible.
 */
export function mustSignIn(path: string | null, signedIn: boolean): boolean {
  if (signedIn) return false;
  if (path === null) return false;
  return !isLoginPath(path);
}

/**
 * Where to send someone once they are in.
 *
 * The middleware has recorded `?next=` since it was written, and its comment has always promised
 * signing in returns you there — while the form navigated to "/" regardless. Honouring the promise
 * makes the value attacker-reachable, because it travels in a URL anyone can send. So it is only
 * ever allowed to be a path on this same site: one leading slash, no second slash and no backslash
 * after it (both of which name another host), and never the login page itself.
 */
export function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (isLoginPath(raw)) return "/";
  return raw;
}
