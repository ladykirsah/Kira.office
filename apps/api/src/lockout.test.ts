import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { loginStaff } from "./staffSession";
import { hashPassword, LOCK_AFTER_FAILURES } from "@l-shopee/core";

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

async function seed(db: DatabaseSync, role: string) {
  const { hash, salt, iterations } = await hashPassword("correct-horse");
  db.prepare(
    `INSERT INTO users (id, name, email, role, status, created_at, failed_attempts,
                        password_hash, password_salt, password_iterations)
     VALUES ('u1', 'Person', 'p@shop.local', ?, 'active', ?, 0, ?, ?, ?)`,
  ).run(role, NOW, hash, salt, iterations);
}

/** Enough wrong guesses to trip the 3-strike lock. */
async function guessWrong(db: D1Database, times: number) {
  for (let i = 0; i < times; i++) {
    await loginStaff(db, "p@shop.local", "wrong", NOW + i);
  }
}

describe("account lockout by role", () => {
  /**
   * The owner's decision of 2026-08-25 REVERSES the 9 Aug exemption, and the reason is that its
   * premise expired.
   *
   * Admins and super admins were exempted because the recovery for a lock is "ask a super admin",
   * which is no recovery when the person locked out IS the super admin. That was safe only while
   * Cloudflare Access stood in front of the whole back office: nobody could reach the login form to
   * guess at it. The owner is now making the Kira.office form the everyday door, which puts it on
   * the open internet — and an account that can never be locked, behind a SIX-DIGIT PIN, is a
   * million guesses with nothing counting them.
   *
   * The exemption's premise is also gone: `/recover` is a real way back that needs no other person,
   * so a locked-out super admin is no longer stuck.
   */
  it("given a super admin > then three wrong tries lock the account, like everyone else", async () => {
    const db = migratedDb();
    await seed(db, "super_admin");
    const d1 = asD1(db);
    await guessWrong(d1, LOCK_AFTER_FAILURES);

    const out = await loginStaff(d1, "p@shop.local", "correct-horse", NOW + 100);
    expect(out).toMatchObject({ ok: false, reason: "locked" });
  });

  it("given a mechanic > then three wrong tries still lock the account", async () => {
    const db = migratedDb();
    await seed(db, "mechanic");
    const d1 = asD1(db);
    await guessWrong(d1, LOCK_AFTER_FAILURES);

    // Even the RIGHT password is refused while the lock stands — that is what a lock means.
    const out = await loginStaff(d1, "p@shop.local", "correct-horse", NOW + 100);
    expect(out).toMatchObject({ ok: false, reason: "locked" });
  });

  it("given an admin > then three wrong tries lock the account too", async () => {
    // Reversed on 2026-08-25 along with the super admin, and for the same reason: with the login
    // form on the open internet, "never locks" is "guess forever".
    const db = migratedDb();
    await seed(db, "admin");
    const d1 = asD1(db);
    await guessWrong(d1, LOCK_AFTER_FAILURES);

    expect(await loginStaff(d1, "p@shop.local", "correct-horse", NOW + 100)).toMatchObject({
      ok: false,
      reason: "locked",
    });
  });

  it("given wrong guesses short of the limit > then they are counted, and a clean sign-in wipes the tally", async () => {
    // Not locking yet is not the same as not noticing. The tally is what makes a burst of failed
    // sign-ins visible afterwards, and getting it right still clears it.
    const db = migratedDb();
    await seed(db, "admin");
    const d1 = asD1(db);
    await guessWrong(d1, LOCK_AFTER_FAILURES - 1);
    expect(db.prepare(`SELECT failed_attempts FROM users`).get()).toMatchObject({
      failed_attempts: LOCK_AFTER_FAILURES - 1,
    });

    expect((await loginStaff(d1, "p@shop.local", "correct-horse", NOW + 100)).ok).toBe(true);
    expect(db.prepare(`SELECT failed_attempts FROM users`).get()).toMatchObject({
      failed_attempts: 0,
    });
  });

  it("given a standing lock on an admin > then even the right password is refused", async () => {
    // The 9 Aug change carried a one-time concession letting an already-locked admin straight back
    // in, because locks no longer applied to them. Locks apply again, so a standing lock stands.
    // Nobody is stranded by this: /recover is the owner's way back, and an admin asks a super admin
    // — the ordinary path that was always there for mechanics.
    const db = migratedDb();
    await seed(db, "admin");
    db.prepare(`UPDATE users SET failed_attempts = 3, locked_until = ${NOW + 86_400_000}`).run();

    expect(await loginStaff(asD1(db), "p@shop.local", "correct-horse", NOW)).toMatchObject({
      ok: false,
      reason: "locked",
    });
  });

  it("given a lock that has since expired > then the right password works again", async () => {
    // A lock is 24 hours, not forever — the wall has to come down on its own.
    const db = migratedDb();
    await seed(db, "super_admin");
    db.prepare(`UPDATE users SET failed_attempts = 3, locked_until = ${NOW - 1}`).run();

    expect((await loginStaff(asD1(db), "p@shop.local", "correct-horse", NOW)).ok).toBe(true);
  });
});
