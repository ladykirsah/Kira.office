import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { signInAsOwner } from "./staffSession";

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

const NOW = 1_785_000_000_000;
const OWNER = "lady.kirsah@gmail.com";
const env = { accessConfigured: true, superAdminEmails: OWNER };

describe("signInAsOwner > the account does not exist yet", () => {
  it("given a verified owner and no row > then it is created as an active super admin", async () => {
    // The state production was actually in: Access lets the owner reach the login page, but nothing
    // in the app can create the first staff account, so there was nothing to sign in to.
    const db = migratedDb();
    const out = await signInAsOwner(asD1(db), OWNER, env, NOW);
    expect(out.ok).toBe(true);
    const row = db.prepare(`SELECT email, role, status FROM users`).get();
    expect(row).toMatchObject({ email: OWNER, role: "super_admin", status: "active" });
  });

  it("given it was created > then a working session comes back with it", async () => {
    const db = migratedDb();
    const out = await signInAsOwner(asD1(db), OWNER, env, NOW);
    if (!out.ok) throw new Error("expected a session");
    expect(out.token).toMatch(/.{16,}/);
    expect(out.identity).toMatchObject({ email: OWNER, role: "super_admin" });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM staff_sessions`).get()).toMatchObject({ n: 1 });
  });
});

describe("signInAsOwner > the account exists but is unusable", () => {
  function seedBroken(db: DatabaseSync, extra = "") {
    db.prepare(
      `INSERT INTO users (id, name, email, role, status, created_at, failed_attempts,
                          password_hash, password_salt, password_iterations ${extra ? "," + extra.split("=")[0] : ""})
       VALUES ('u1', 'Owner', ?, 'mechanic', 'inactive', ${NOW}, 3, 'x', 'y', 210000
               ${extra ? "," + extra.split("=")[1] : ""})`,
    ).run(OWNER);
  }

  it("given a locked, demoted, deactivated row > then signing in repairs all of it", async () => {
    // Every way the row could be stuck at once. The owner must not have to work out which.
    const db = migratedDb();
    seedBroken(db);
    db.prepare(`UPDATE users SET locked_until = ${NOW + 86_400_000} WHERE id='u1'`).run();

    const out = await signInAsOwner(asD1(db), OWNER, env, NOW);
    expect(out.ok).toBe(true);
    expect(
      db.prepare(`SELECT role, status, failed_attempts, locked_until FROM users`).get(),
    ).toMatchObject({
      role: "super_admin",
      status: "active",
      failed_attempts: 0,
      locked_until: null,
    });
  });

  it("given a soft-deleted row > then it is restored rather than duplicated", async () => {
    const db = migratedDb();
    seedBroken(db);
    db.prepare(`UPDATE users SET deleted_at = ${NOW} WHERE id='u1'`).run();

    expect((await signInAsOwner(asD1(db), OWNER, env, NOW)).ok).toBe(true);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM users`).get()).toMatchObject({ n: 1 });
    expect(db.prepare(`SELECT deleted_at FROM users`).get()).toMatchObject({ deleted_at: null });
  });

  it("given the unverifiable 210k password > then it is left alone, not silently cleared", async () => {
    // Signing in this way proves ownership via Access; it says nothing about the password. Wiping
    // it would quietly remove a credential the owner may still use once it is reset properly.
    const db = migratedDb();
    seedBroken(db);
    await signInAsOwner(asD1(db), OWNER, env, NOW);
    expect(db.prepare(`SELECT password_hash FROM users`).get()).toMatchObject({
      password_hash: "x",
    });
  });
});

describe("signInAsOwner > refusals", () => {
  it("given Access is not configured > then refused and NOTHING is written", async () => {
    // The fail-open that would matter most: a deployment missing its ACCESS_* variables must not
    // hand out super-admin sessions.
    const db = migratedDb();
    const out = await signInAsOwner(asD1(db), OWNER, { ...env, accessConfigured: false }, NOW);
    expect(out).toMatchObject({ ok: false, reason: "access_not_configured" });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM users`).get()).toMatchObject({ n: 0 });
  });

  it("given someone Access admits who is not the owner > then refused as plain 'invalid'", async () => {
    // Reported as `invalid`, NOT `not_an_owner`: a distinct reason would turn this endpoint into a
    // way to ask "is this address an owner?" and enumerate the answer. Everyone Access admits can
    // reach it, so it must tell them nothing they did not already know.
    const db = migratedDb();
    const out = await signInAsOwner(asD1(db), "staff@gmail.com", env, NOW);
    expect(out).toMatchObject({ ok: false, reason: "invalid" });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM users`).get()).toMatchObject({ n: 0 });
  });

  it("given the allowlist is unset > then refused, never opened to everyone", async () => {
    const db = migratedDb();
    const out = await signInAsOwner(asD1(db), OWNER, { accessConfigured: true }, NOW);
    expect(out.ok).toBe(false);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM users`).get()).toMatchObject({ n: 0 });
  });
});
