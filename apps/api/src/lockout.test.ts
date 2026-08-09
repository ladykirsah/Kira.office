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
  it("given a mechanic > then three wrong tries still lock the account", async () => {
    const db = migratedDb();
    await seed(db, "mechanic");
    const d1 = asD1(db);
    await guessWrong(d1, LOCK_AFTER_FAILURES);

    // Even the RIGHT password is refused while the lock stands — that is what a lock means.
    const out = await loginStaff(d1, "p@shop.local", "correct-horse", NOW + 100);
    expect(out).toMatchObject({ ok: false, reason: "locked" });
  });

  it("given an admin > then three wrong tries do NOT lock, and the right one still works", async () => {
    // The owner's change (9 Aug 2026): a locked-out admin has no way back, because the recovery for
    // a lock is "ask a super admin".
    const db = migratedDb();
    await seed(db, "admin");
    const d1 = asD1(db);
    await guessWrong(d1, LOCK_AFTER_FAILURES + 2);

    expect(db.prepare(`SELECT locked_until FROM users`).get()).toMatchObject({
      locked_until: null,
    });
    expect((await loginStaff(d1, "p@shop.local", "correct-horse", NOW + 100)).ok).toBe(true);
  });

  it("given a super admin > then the same, however many times they get it wrong", async () => {
    const db = migratedDb();
    await seed(db, "super_admin");
    const d1 = asD1(db);
    await guessWrong(d1, 25);

    expect(db.prepare(`SELECT locked_until FROM users`).get()).toMatchObject({
      locked_until: null,
    });
    expect((await loginStaff(d1, "p@shop.local", "correct-horse", NOW + 100)).ok).toBe(true);
  });

  it("given an exempt admin > then wrong guesses are still COUNTED, just never enforced", async () => {
    // Not locking is not the same as not noticing. The tally is what makes a burst of failed
    // sign-ins visible afterwards, and a clean sign-in still wipes it.
    const db = migratedDb();
    await seed(db, "admin");
    const d1 = asD1(db);
    await guessWrong(d1, 4);
    expect(db.prepare(`SELECT failed_attempts FROM users`).get()).toMatchObject({
      failed_attempts: 4,
    });

    await loginStaff(d1, "p@shop.local", "correct-horse", NOW + 100);
    expect(db.prepare(`SELECT failed_attempts FROM users`).get()).toMatchObject({
      failed_attempts: 0,
    });
  });

  it("given an admin already locked from before > then the old lock no longer holds them out", async () => {
    // Whoever is stuck behind a lock set before this change must not have to wait it out.
    const db = migratedDb();
    await seed(db, "admin");
    db.prepare(`UPDATE users SET failed_attempts = 3, locked_until = ${NOW + 86_400_000}`).run();

    expect((await loginStaff(asD1(db), "p@shop.local", "correct-horse", NOW)).ok).toBe(true);
  });
});
