import { describe, it, expect, vi } from "vitest";

// `cloudflare:workers` is a Workers-runtime virtual module that doesn't exist under Node/vitest.
// Stub its DurableObject base so importing the Worker (which extends it) works in tests.
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

const { default: worker } = await import("./index");
type Env = import("./index").Env;

/**
 * The staff session as the ONLY gate.
 *
 * Until now the back office was guarded at the edge by Cloudflare Access, and `requireAccess`
 * deliberately fails OPEN when `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` are unset — so that a
 * deployment which had lost its Access configuration kept working. That is the wrong direction for
 * the owner's decision of 2026-08-25: the everyday door is to be the Kira.office PIN/password
 * screen, which means the staff session has to be load-bearing on its own, and a missing
 * configuration must read as "refuse", never as "let everyone in".
 *
 * These tests run with NO Access variables set — exactly the shape of a deployment with the
 * Cloudflare door taken off — and assert the API still refuses a stranger.
 */

const ctx = {} as ExecutionContext;

/**
 * Minimal D1 double.
 *
 * `signedIn` decides only what the staff-session lookup answers; every other query returns nothing,
 * because these tests are about the gate and not about any route's payload.
 */
function makeEnv({ signedIn, role = "super_admin" }: { signedIn: boolean; role?: string }): Env {
  const db = {
    prepare: (sql: string) => {
      const stmt = {
        bind: () => stmt,
        async first<T = unknown>(): Promise<T | null> {
          if (sql.includes("FROM staff_sessions s") && signedIn) {
            return {
              userId: "u-test",
              email: "boss@shop.test",
              name: "Boss",
              role,
              sessionId: "s-test",
              lastSeenAt: Date.now(),
            } as T;
          }
          return null;
        },
        async all<T = unknown>() {
          return { results: [] as T[] };
        },
        async run() {
          return { success: true };
        },
      };
      return stmt;
    },
    batch: async () => [],
  } as unknown as D1Database;

  // No ACCESS_TEAM_DOMAIN, no ACCESS_AUD: the post-Cloudflare world.
  return { DB: db } as unknown as Env;
}

const AUTHED = { "X-Staff-Session": "test-token" };

describe("API gate > staff session is the only gate", () => {
  it("GET /banners > given no staff session and Access switched off > refuses with 401", async () => {
    const res = await worker.fetch!(
      new Request("https://x/banners"),
      makeEnv({ signedIn: false }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  /**
   * Claims are the mechanic's and the super-admin's call, never a plain admin's — and that decision
   * used to run through `viewerRole()`, which promoted EVERYONE to super_admin whenever ACCESS_AUD
   * was unset. Unset is exactly what a deployment looks like once the Cloudflare door comes off, so
   * the rule has to hold without it. Refused before the body is read, hence no claim to seed.
   */
  it("PATCH /claims/:id > given a signed-in admin and Access switched off > 403, not a promotion", async () => {
    const res = await worker.fetch!(
      new Request("https://x/claims/c1", {
        method: "PATCH",
        headers: { ...AUTHED, "content-type": "application/json" },
        body: JSON.stringify({ state: "approved" }),
      }),
      makeEnv({ signedIn: true, role: "admin" }),
      ctx,
    );
    expect(res.status).toBe(403);
  });
});
