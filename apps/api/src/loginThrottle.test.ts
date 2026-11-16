import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { hashPassword, pinLookup } from "@l-shopee/core";
import {
  STAFF_LOGIN_MAX_FAILURES,
  STAFF_LOGIN_WINDOW_MS,
  PIN_SHOP_MAX_MISSES,
  loginThrottleKey,
  recoveryThrottleKey,
  isRecoveryThrottled,
  isLoginThrottled,
  recordLoginFailure,
  clearLoginFailures,
  clientAddress,
} from "./loginThrottle";

/**
 * Why this exists even though accounts already lock after three strikes.
 *
 * The account lock is keyed to an ACCOUNT, and PIN sign-in has no account until the PIN matches one.
 * `loginWithPin` looks the row up by the PIN's peppered hash and, finding none, answers "invalid"
 * having touched nothing — correctly, since there is no account to punish and punishing a guess
 * would reveal which six digits are in use. The consequence is that every WRONG guess is free: all
 * 999,999 of them, and the millionth signs you in.
 *
 * Survivable while Cloudflare Access stood in front of the form. The owner's decision of 2026-08-25
 * puts the form on the open internet, so the guesses have to be counted against something that
 * exists before the account does — whoever is asking.
 *
 * Tested against the REAL migrated schema and the REAL statement, not a fake: the whole correctness
 * of the counter is in one upsert, and a mock would only prove the mock counts.
 */

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  return db;
}

function asD1(db: DatabaseSync): D1Database {
  const make = (sql: string) => {
    let binds: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        binds = args;
        return stmt;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        return { results: db.prepare(sql).all(...(binds as never[])) as T[] };
      },
      async first<T = unknown>(): Promise<T | null> {
        return (db.prepare(sql).get(...(binds as never[])) as T | undefined) ?? null;
      },
      async run() {
        return db.prepare(sql).run(...(binds as never[]));
      },
    };
    return stmt;
  };
  return { prepare: (sql: string) => make(sql) } as unknown as D1Database;
}

const NOW = 1_800_000_000_000;
const KEY = loginThrottleKey("203.0.113.9");

async function failTimes(db: D1Database, times: number, at = NOW) {
  for (let i = 0; i < times; i++) await recordLoginFailure(db, KEY, at);
}

describe("login throttle", () => {
  it("given a caller who has never failed > then not throttled", async () => {
    const db = asD1(migratedDb());
    expect(await isLoginThrottled(db, KEY, NOW)).toBe(false);
  });

  it("given failures one short of the limit > then still not throttled", async () => {
    const db = asD1(migratedDb());
    await failTimes(db, STAFF_LOGIN_MAX_FAILURES - 1);
    expect(await isLoginThrottled(db, KEY, NOW)).toBe(false);
  });

  it("given the limit reached > then throttled", async () => {
    const db = asD1(migratedDb());
    await failTimes(db, STAFF_LOGIN_MAX_FAILURES);
    expect(await isLoginThrottled(db, KEY, NOW)).toBe(true);
  });

  it("given the limit reached and the window since passed > then allowed again", async () => {
    // A wall that never comes down would turn one bad afternoon into a permanent lockout of an
    // entire office, since a shop shares one connection.
    const db = asD1(migratedDb());
    await failTimes(db, STAFF_LOGIN_MAX_FAILURES);
    expect(await isLoginThrottled(db, KEY, NOW + STAFF_LOGIN_WINDOW_MS)).toBe(false);
  });

  it("given two different callers > then they do not share a budget", async () => {
    // Otherwise one guesser on the internet locks the shop's own counter staff out of their tills.
    const db = asD1(migratedDb());
    await failTimes(db, STAFF_LOGIN_MAX_FAILURES);
    expect(await isLoginThrottled(db, loginThrottleKey("198.51.100.4"), NOW)).toBe(false);
  });

  it("given a successful sign-in > then the caller's tally is cleared", async () => {
    // Someone who fumbled their PIN a few times and then got it right is not mid-attack, and must
    // not carry those misses into the rest of their shift.
    const db = asD1(migratedDb());
    await failTimes(db, STAFF_LOGIN_MAX_FAILURES - 1);
    await clearLoginFailures(db, KEY);
    await failTimes(db, 1);
    expect(await isLoginThrottled(db, KEY, NOW)).toBe(false);
  });

  it("given failures spread across a window boundary > then the count starts over in the new window", async () => {
    const db = asD1(migratedDb());
    await failTimes(db, STAFF_LOGIN_MAX_FAILURES - 1);
    await failTimes(db, 1, NOW + STAFF_LOGIN_WINDOW_MS);
    expect(await isLoginThrottled(db, KEY, NOW + STAFF_LOGIN_WINDOW_MS)).toBe(false);
  });

  it("keys are namespaced away from the storefront's own throttles", async () => {
    // The table is shared with the storefront's OTP limits. A collision would have one flow
    // silently spending another's budget.
    expect(KEY.startsWith("staff-login:")).toBe(true);
  });
});

// `cloudflare:workers` is a Workers-runtime virtual module that doesn't exist under Node/vitest.
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
const ctx = {} as ExecutionContext;

/** A wrong PIN, from an address the throttle can tell apart from any other test's. */
function guess(pin: string) {
  return new Request("https://x/staff/login-pin", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.77" },
    body: JSON.stringify({ pin }),
  });
}

describe("POST /staff/login-pin > the throttle in front of the route", () => {
  /**
   * The whole point, end to end: a PIN matching NOBODY never touches an account, so nothing else in
   * the system counts these. Without this the six-digit space is walkable.
   */
  it("given a run of wrong PINs from one caller > then the door shuts with 429", async () => {
    const env = { DB: asD1(migratedDb()), STAFF_PIN_PEPPER: "pepper" } as unknown as Env;

    // The shop-wide brake (6) is tighter than the per-address one (20), so it shuts first.
    for (let i = 0; i < PIN_SHOP_MAX_MISSES; i++) {
      const res = await worker.fetch!(guess("000000"), env, ctx);
      expect(res.status, `attempt ${i + 1} should still be a plain refusal`).toBe(401);
    }

    const shut = await worker.fetch!(guess("000000"), env, ctx);
    expect(shut.status).toBe(429);
    // Told how long to wait, rather than left guessing whether they are broken or banned.
    expect(Number(shut.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  /**
   * Bug hunt 15 Nov 2026: the door checked "too many?" first and counted a miss only afterwards, so
   * a burst sent all at once got every guess checked before any was counted.
   */
  it("given 30 wrong PINs sent at once > then no more than 6 are checked; the rest get 429", async () => {
    const env = { DB: asD1(migratedDb()), STAFF_PIN_PEPPER: "pepper" } as unknown as Env;
    const answers = await Promise.all(
      Array.from({ length: 30 }, () => worker.fetch!(guess("000000"), env, ctx)),
    );
    const statuses = answers.map((r) => r.status);
    expect(statuses.filter((s) => s === 401).length).toBe(PIN_SHOP_MAX_MISSES);
    expect(statuses.filter((s) => s === 429).length).toBe(30 - PIN_SHOP_MAX_MISSES);
  });

  it("given the throttle has shut > then even the RIGHT credential is refused", async () => {
    // A throttle that lets a correct guess through is not a throttle — it is a formality the
    // millionth attempt walks past.
    const env = { DB: asD1(migratedDb()), STAFF_PIN_PEPPER: "pepper" } as unknown as Env;
    for (let i = 0; i < STAFF_LOGIN_MAX_FAILURES; i++)
      await worker.fetch!(guess("000000"), env, ctx);

    const res = await worker.fetch!(
      new Request("https://x/staff/login", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.77" },
        body: JSON.stringify({ email: "p@shop.local", password: "correct-horse" }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(429);
  });
});

/** A PIN from a given address, so a test can play a guesser who keeps changing address. */
function pinFrom(pin: string, address: string) {
  return new Request("https://x/staff/login-pin", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": address },
    body: JSON.stringify({ pin }),
  });
}

/** A migrated database with one member of staff whose PIN is 481920. */
async function shopWithOnePin() {
  const raw = migratedDb();
  const hashed = await hashPassword("481920", { iterations: 1000 });
  raw
    .prepare(
      `INSERT INTO users (id, name, email, role, status, created_at,
                          pin_hash, pin_salt, pin_iterations, pin_lookup)
       VALUES ('somchai', 'somchai', 'somchai@shop.test', 'mechanic', 'active', ?, ?, ?, ?, ?)`,
    )
    .run(NOW, hashed.hash, hashed.salt, hashed.iterations, await pinLookup("481920", "pepper"));
  return { DB: asD1(raw), STAFF_PIN_PEPPER: "pepper" } as unknown as Env;
}

/**
 * Owner, 16 Nov 2026: "6 wrong is max". The per-address limit cannot see a guesser who changes
 * address for every try, so wrong PINs are also counted across the whole shop.
 */
describe("POST /staff/login-pin > the shop-wide brake", () => {
  it("given 6 wrong PINs from 6 different addresses > then the next PIN is refused with 429, even the right one", async () => {
    const env = await shopWithOnePin();
    for (let i = 0; i < PIN_SHOP_MAX_MISSES; i++) {
      const res = await worker.fetch!(pinFrom("000000", `198.51.100.${i + 1}`), env, ctx);
      expect(res.status, `wrong PIN ${i + 1} is a plain refusal`).toBe(401);
    }
    const paused = await worker.fetch!(pinFrom("481920", "198.51.100.200"), env, ctx);
    expect(paused.status).toBe(429);
    expect(Number(paused.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("given the pause > then a browser on another address can read the answer", async () => {
    // Found 16 Nov 2026 on the local app: the "wait" answer had no cross-site header, so the browser
    // hid it and the sign-in screen said "Can't reach the server" instead of "Too many tries".
    const env = await shopWithOnePin();
    for (let i = 0; i < PIN_SHOP_MAX_MISSES; i++)
      await worker.fetch!(pinFrom("000000", `198.51.100.${i + 1}`), env, ctx);
    const paused = await worker.fetch!(pinFrom("481920", "198.51.100.200"), env, ctx);
    expect(paused.status).toBe(429);
    expect(paused.headers.get("access-control-allow-origin")).not.toBeNull();
  });

  it("given the pause > then email and password, and the emergency key, are not paused", async () => {
    const env = await shopWithOnePin();
    for (let i = 0; i < PIN_SHOP_MAX_MISSES + 1; i++)
      await worker.fetch!(pinFrom("000000", `198.51.100.${i + 1}`), env, ctx);
    const post = (path: string, body: unknown) =>
      worker.fetch!(
        new Request(`https://x${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", "cf-connecting-ip": "192.0.2.10" },
          body: JSON.stringify(body),
        }),
        env,
        ctx,
      );
    // No such account / no such key: refused as wrong, never as "wait".
    expect((await post("/staff/login", { email: "a@shop.test", password: "x" })).status).not.toBe(
      429,
    );
    expect((await post("/staff/login-recovery", { key: "nope" })).status).not.toBe(429);
  });

  it("given 5 wrong PINs then a right one > then the shop's tally starts over", async () => {
    const env = await shopWithOnePin();
    for (let i = 0; i < PIN_SHOP_MAX_MISSES - 1; i++)
      await worker.fetch!(pinFrom("000000", `198.51.100.${i + 1}`), env, ctx);
    expect((await worker.fetch!(pinFrom("481920", "198.51.100.50"), env, ctx)).status).toBe(200);
    for (let i = 0; i < PIN_SHOP_MAX_MISSES; i++) {
      const res = await worker.fetch!(pinFrom("000000", `198.51.100.${i + 60}`), env, ctx);
      expect(res.status, `wrong PIN ${i + 1} after the right one`).toBe(401);
    }
  });
});

describe("clientAddress", () => {
  const req = (headers: Record<string, string>) => new Request("https://x/", { headers });

  it("given Cloudflare's own header > then that, because the edge sets it and a caller cannot", () => {
    expect(clientAddress(req({ "cf-connecting-ip": "203.0.113.5" }))).toBe("203.0.113.5");
  });

  it("given a forwarded address and Cloudflare's header > then Cloudflare's wins", () => {
    // Order matters for safety, not taste. `cf-connecting-ip` is stamped at the edge and cannot be
    // spoofed by a caller; the forwarded one is just a header. Preferring the edge's means an
    // attacker reaching this Worker directly can never pick their own bucket to spend.
    expect(
      clientAddress(req({ "cf-connecting-ip": "203.0.113.5", "x-kira-client-ip": "198.51.100.9" })),
    ).toBe("203.0.113.5");
  });

  it("given only a forwarded address > then that", () => {
    // The admin app proxies sign-ins server-to-server, and a subrequest need not carry the edge's
    // header. Without this every member of staff would share ONE bucket, and twenty fumbles between
    // them would shut the whole shop out of its own tills.
    expect(clientAddress(req({ "x-kira-client-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("given neither > then one shared bucket, which is a refusal to guess", () => {
    // Local dev, and nothing else: in production the edge always stamps its header. Sharing a
    // bucket is the safe direction — the alternative is inventing a unique key per request, which
    // is a throttle that never throttles.
    expect(clientAddress(req({}))).toBe("unknown");
  });
});

/**
 * THE EMERGENCY DOOR'S OWN BUDGET (owner, 2026-08-26: "slow them down, never lock").
 *
 * Its own bucket and its own, much smaller allowance. The everyday door tolerates twenty misses
 * because a shop behind one address fumbles all day; the emergency door is used once in a year, by
 * one person, who knows the key — so five is generous for them and ruinous for a guesser.
 *
 * And a separate bucket in both directions: a busy till must never spend the owner's rescue budget,
 * and somebody grinding at the rescue must never lock the tills out of the shop.
 */
describe("the emergency key's throttle", () => {
  const NOW = 1_800_000_000_000;

  it("has its own bucket, which the everyday login cannot spend", () => {
    expect(recoveryThrottleKey("1.2.3.4")).not.toBe(loginThrottleKey("1.2.3.4"));
  });

  it("shuts the door after five misses, where the everyday one allows twenty", async () => {
    const db = asD1(migratedDb());
    const key = recoveryThrottleKey("1.2.3.4");
    for (let i = 0; i < 4; i++) await recordLoginFailure(db, key, NOW);
    expect(await isRecoveryThrottled(db, key, NOW)).toBe(false);
    await recordLoginFailure(db, key, NOW);
    expect(await isRecoveryThrottled(db, key, NOW)).toBe(true);
  });

  /** Never a lock: fall quiet for a window and the door answers again. That was the owner's choice. */
  it("opens again in the next window — it slows a guesser, it never locks the owner out", async () => {
    const db = asD1(migratedDb());
    const key = recoveryThrottleKey("1.2.3.4");
    for (let i = 0; i < 6; i++) await recordLoginFailure(db, key, NOW);
    expect(await isRecoveryThrottled(db, key, NOW)).toBe(true);
    expect(await isRecoveryThrottled(db, key, NOW + STAFF_LOGIN_WINDOW_MS)).toBe(false);
  });

  it("five misses at the rescue leave the everyday door untouched", async () => {
    const db = asD1(migratedDb());
    for (let i = 0; i < 6; i++) await recordLoginFailure(db, recoveryThrottleKey("1.2.3.4"), NOW);
    expect(await isLoginThrottled(db, loginThrottleKey("1.2.3.4"), NOW)).toBe(false);
  });
});
