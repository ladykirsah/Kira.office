import { describe, expect, it } from "vitest";
import { mustSignIn, safeNextPath } from "./signedInGate";

/**
 * The gate that decides whether a page may be drawn for someone the API does not recognise.
 *
 * The bug these exist for (24 Aug 2026): the middleware only checks that the session COOKIE is
 * present, which it cannot verify — it has no database. A cookie whose session had been revoked,
 * expired, or whose user was deleted therefore sailed straight through, and the back office
 * rendered in full for nobody at all: no name in the corner, no redirect, no message. The owner
 * looked at a normal-seeming screen and had no way to tell they were not signed in as themselves.
 *
 * `mustSignIn` takes the answer from the only thing that actually knows — the API's verdict on the
 * token, which the root layout already asks for once per request.
 */
describe("mustSignIn", () => {
  it("given a signed-in viewer on a gated page > then lets the page render", () => {
    expect(mustSignIn("/products", true)).toBe(false);
  });

  it("given a signed-out viewer on a gated page > then demands a sign-in", () => {
    expect(mustSignIn("/products", false)).toBe(true);
  });

  it("given a dead session on the dashboard > then demands a sign-in", () => {
    // The exact shape of the 24 Aug incident: cookie present, session gone.
    expect(mustSignIn("/", false)).toBe(true);
  });

  it("given no path header > then lets it render — the middleware did not gate this request", () => {
    // Assets and the login route handlers are outside the matcher. Nothing to protect, and
    // redirecting them would break signing in.
    expect(mustSignIn(null, false)).toBe(false);
  });

  it("given the login page itself > then lets it render, so there is no redirect loop", () => {
    expect(mustSignIn("/login", false)).toBe(false);
  });

  it("given a sub-path of login > then still lets it render", () => {
    expect(mustSignIn("/login/help", false)).toBe(false);
  });

  it("given a path that merely starts with the letters of login > then still demands a sign-in", () => {
    // "/loginhelp" is not the login page. A bare startsWith("/login") would wave it through.
    expect(mustSignIn("/loginhelp", false)).toBe(true);
  });

  it("given a product whose name contains login > then demands a sign-in", () => {
    expect(mustSignIn("/products/login-cable", false)).toBe(true);
  });

  /**
   * The owner's rescue door (2026-08-25). Forgetting both the PIN and the password used to be
   * survivable because Cloudflare Access stood in front of the whole admin and could prove who you
   * were by email. Once that door comes off the everyday login, `/recover` is the one address it
   * still covers — so this page must open for someone with no session, exactly like `/login`, or
   * the rescue redirects to the very form they cannot get past.
   */
  it("given the rescue page and no session > then lets it render, because that is its whole job", () => {
    expect(mustSignIn("/recover", false)).toBe(false);
  });

  it("given a path that merely starts with the letters of recover > then demands a sign-in", () => {
    // Same trap as /loginhelp: a bare startsWith would open pages nobody meant to open.
    expect(mustSignIn("/recovery-report", false)).toBe(true);
  });

  it("given the login page with a query string > then lets it render", () => {
    expect(mustSignIn("/login?expired=1", false)).toBe(false);
  });
});

/**
 * Where to send someone after they sign in.
 *
 * The middleware has always recorded `?next=`, and its comment has always claimed signing in
 * returns you there — but the form navigated to "/" regardless, so the claim was untrue for as
 * long as it has been written down. Honouring it means the value is now attacker-reachable (it is
 * in a URL anyone can send), so it is only ever allowed to be a path on this same site.
 */
describe("safeNextPath", () => {
  it("given nothing > then the dashboard", () => {
    expect(safeNextPath(null)).toBe("/");
  });

  it("given an empty string > then the dashboard", () => {
    expect(safeNextPath("")).toBe("/");
  });

  it("given a path on this site > then that path", () => {
    expect(safeNextPath("/products")).toBe("/products");
  });

  it("given a path with a query string > then it is kept whole", () => {
    expect(safeNextPath("/products?tab=not-live")).toBe("/products?tab=not-live");
  });

  it("given a protocol-relative URL > then the dashboard", () => {
    // "//evil.example" is a URL to another site, not a path on this one.
    expect(safeNextPath("//evil.example")).toBe("/");
  });

  it("given an absolute URL > then the dashboard", () => {
    expect(safeNextPath("https://evil.example/steal")).toBe("/");
  });

  it("given a backslash-escaped host > then the dashboard", () => {
    // Some browsers normalise "/\" to "//", which is another site again.
    expect(safeNextPath("/\\evil.example")).toBe("/");
  });

  it("given a path with no leading slash > then the dashboard", () => {
    expect(safeNextPath("products")).toBe("/");
  });

  it("given the login page > then the dashboard, so signing in never returns to the form", () => {
    expect(safeNextPath("/login")).toBe("/");
  });
});
