import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  createStaff,
  listAdvancesFor,
  listStaff,
  markSalaryPaid,
  recordAdvance,
  revealPassword,
  salaryMonth,
  setStaffPin,
  staffPayments,
  staffProfileFor,
  updateStaffProfile,
} from "./staffRoutes";
import { hashPassword, LOCK_AFTER_FAILURES } from "@l-shopee/core";
import { createStaffSession, loginStaff, loginWithPin, type StaffIdentity } from "./staffSession";

// `cloudflare:workers` only exists inside the Workers runtime; the Worker's Durable Object extends
// its base class, so importing the Worker for the route tests needs this stand-in.
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
 * The Expo staff page (พนักงาน): the server pieces it needs — people with no email who sign in by
 * PIN alone, the add form saved in one request, a photo per person, and who handed the money over.
 * Every test here runs against a real sqlite built from the real migrations.
 */

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);
const migrationFiles = () =>
  readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

/** Every migration before the cut, so rows can be written the way prod holds them today. */
function migratedBefore(cut: string): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const f of migrationFiles().filter((n) => n < cut)) {
    db.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  return db;
}

/**
 * The rest, each inside its own transaction — the way D1 applies a migration file. The users rebuild
 * in 0097 only balances its deferred foreign-key checks at COMMIT, so this is the honest replay.
 */
function applyFrom(db: DatabaseSync, cut: string) {
  for (const f of migrationFiles().filter((n) => n >= cut)) {
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(join(migrationsDir, f), "utf8"));
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

const NOW = 1_800_000_000_000;

/** Every foreign key in the schema that points at users, as "table.column". */
function foreignKeysToUsers(db: DatabaseSync): string[] {
  return (
    db
      .prepare(
        `SELECT m.name AS tbl, f."from" AS col
           FROM sqlite_master m, pragma_foreign_key_list(m.name) f
          WHERE m.type = 'table' AND f."table" = 'users'
          ORDER BY m.name, f."from"`,
      )
      .all() as { tbl: string; col: string }[]
  ).map((r) => `${r.tbl}.${r.col}`);
}

describe("migration 0097 > users.email becomes optional, nothing else moves", () => {
  /** Two people with EVERY column filled, so a column the rebuild forgot would show as a loss. */
  function seedFullUsers(db: DatabaseSync) {
    const cols = db.prepare(`PRAGMA table_info(users)`).all() as { name: string; type: string }[];
    const valueFor = (person: string, col: { name: string; type: string }, i: number) => {
      if (col.name === "id") return person;
      if (col.name === "created_by") return person === "boss" ? null : "boss";
      if (col.name === "role") return person === "boss" ? "super_admin" : "mechanic";
      if (col.name === "status") return "active";
      if (col.name === "deleted_at") return null;
      return /int/i.test(col.type) ? 1000 + i : `${person}-${col.name}`;
    };
    for (const person of ["boss", "m1"]) {
      db.prepare(
        `INSERT INTO users (${cols.map((c) => c.name).join(", ")})
         VALUES (${cols.map(() => "?").join(", ")})`,
      ).run(...cols.map((c, i) => valueFor(person, c, i)));
    }
    return cols.map((c) => c.name);
  }

  function seedChildren(db: DatabaseSync) {
    db.exec(`
      INSERT INTO staff_sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at)
        VALUES ('s1', 'h1', 'm1', ${NOW}, ${NOW + 1}, ${NOW});
      INSERT INTO staff_days_off (id, user_id, day, halves, created_at, created_by)
        VALUES ('d1', 'm1', '2026-08-01', 2, ${NOW}, 'boss');
      INSERT INTO staff_payslips (id, user_id, period, day_rate_satang, days_in_month, off_halves,
                                  working_halves, amount_satang, paid_at, created_at)
        VALUES ('p1', 'm1', '2026-08', 50000, 31, 0, 62, 1550000, ${NOW}, ${NOW});
      INSERT INTO staff_activity (id, user_id, kind, created_at)
        VALUES ('a1', 'boss', 'profile_edited', ${NOW});
      INSERT INTO staff_advances (id, user_id, period, given_on, amount_satang, method, created_at)
        VALUES ('adv1', 'm1', '2026-08', '2026-08-10', 100000, 'cash', ${NOW});
      INSERT INTO audit_logs (id, user_id, action, created_at) VALUES ('al1', 'boss', 'POST', ${NOW});
      INSERT INTO coupons (id, code, type, value, created_at, created_by_user_id)
        VALUES ('c1', 'SAVE', 'fixed', 100, ${NOW}, 'boss');
      INSERT INTO onsite_sales (id, client_uuid, cashier_user_id, created_at)
        VALUES ('o1', 'cu1', 'm1', ${NOW});
    `);
  }

  it("given people and the rows that point at them > then every row and every column survives", () => {
    const db = migratedBefore("0097");
    const cols = seedFullUsers(db);
    seedChildren(db);
    const before = db.prepare(`SELECT ${cols.join(", ")} FROM users ORDER BY id`).all();

    applyFrom(db, "0097");

    expect(db.prepare(`SELECT ${cols.join(", ")} FROM users ORDER BY id`).all()).toEqual(before);
    expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([]);
    for (const [table, n] of [
      ["staff_sessions", 1],
      ["staff_days_off", 1],
      ["staff_payslips", 1],
      ["staff_activity", 1],
      ["staff_advances", 1],
      ["audit_logs", 1],
      ["coupons", 1],
      ["onsite_sales", 1],
    ] as const) {
      expect((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n).toBe(n);
    }
  });

  it("after it > every foreign key that pointed at users still does, plus the two payer columns", () => {
    const db = migratedBefore("0097");
    const before = foreignKeysToUsers(db);
    applyFrom(db, "0097");
    expect(foreignKeysToUsers(db)).toEqual(
      [...before, "staff_advances.paid_by", "staff_payslips.paid_by"].sort((a, b) =>
        a.localeCompare(b),
      ),
    );
  });

  it("after it > a child row naming nobody is still refused", () => {
    const db = migratedBefore("0097");
    applyFrom(db, "0097");
    expect(() =>
      db.exec(
        `INSERT INTO staff_sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at)
         VALUES ('s9', 'h9', 'nobody', 1, 2, 1)`,
      ),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("after it > two people with no email can exist, a repeated real email cannot", () => {
    const db = migratedBefore("0097");
    applyFrom(db, "0097");
    const add = (id: string, email: string | null) =>
      db
        .prepare(`INSERT INTO users (id, name, email, role, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(id, id, email, "mechanic", NOW);
    add("n1", null);
    add("n2", null);
    add("e1", "a@shop.test");
    expect(() => add("e2", "a@shop.test")).toThrow(/UNIQUE constraint failed: users.email/);
  });

  it("after it > the PIN and emergency-key lookups are still unique", () => {
    const db = migratedBefore("0097");
    applyFrom(db, "0097");
    const add = (id: string, pin: string | null, recovery: string | null) =>
      db
        .prepare(
          `INSERT INTO users (id, name, role, created_at, pin_lookup, recovery_lookup)
           VALUES (?, ?, 'mechanic', ?, ?, ?)`,
        )
        .run(id, id, NOW, pin, recovery);
    add("p1", "same-pin", null);
    expect(() => add("p2", "same-pin", null)).toThrow(/UNIQUE constraint failed: users.pin_lookup/);
    add("r1", null, "same-key");
    expect(() => add("r2", null, "same-key")).toThrow(
      /UNIQUE constraint failed: users.recovery_lookup/,
    );
  });

  it("after it > the new columns exist: real names, emergency relation, and who paid", () => {
    const db = migratedBefore("0097");
    applyFrom(db, "0097");
    const colsOf = (t: string) =>
      (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
    expect(colsOf("users")).toEqual(
      expect.arrayContaining(["full_name_th", "full_name_en", "emergency_relation"]),
    );
    expect(colsOf("staff_payslips")).toContain("paid_by");
    expect(colsOf("staff_advances")).toContain("paid_by");
  });
});

// ── The API, against the real schema ────────────────────────────────────────────────────────────

/** Everything migrated, empty — the shape every route test starts from. */
const migratedDb = () => migratedBefore("9999");

/** The slice of D1 the staff routes use, with an atomic batch like the real one. */
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
      __exec() {
        return db.prepare(sql).run(...(binds as never[]));
      },
    };
    return stmt;
  };
  return {
    prepare: (sql: string) => make(sql),
    async batch(stmts: { __exec: () => unknown }[]) {
      db.exec("BEGIN");
      try {
        const out = stmts.map((s) => s.__exec());
        db.exec("COMMIT");
        return out;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  } as unknown as D1Database;
}

const PEPPER = "test-pepper";
const KEY = "9f".repeat(32);

const boss: StaffIdentity = {
  userId: "boss",
  email: "boss@shop.test",
  name: "Boss",
  role: "super_admin",
};
const clerk: StaffIdentity = { userId: "c1", email: "c1@shop.test", name: "Nok", role: "admin" };

function withBoss() {
  const raw = migratedDb();
  raw
    .prepare(
      `INSERT INTO users (id, name, email, role, status, created_at)
       VALUES ('boss', 'Boss', 'boss@shop.test', 'super_admin', 'active', ?)`,
    )
    .run(NOW);
  return { raw, db: asD1(raw) };
}

const json = async (res: Response) => (await res.json()) as Record<string, unknown>;
const countUsers = (raw: DatabaseSync) =>
  (raw.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n;

/** The Expo add form, filled in the way the drawing shows it — no email, a PIN instead. */
const ADD_FORM = {
  nameTh: "บอย",
  nameEn: "Boy",
  fullNameTh: "สมชาย ใจดี",
  fullNameEn: "Somchai Jaidee",
  phone: "0812345678",
  email: "  ",
  emergencyName: "มาลี",
  emergencyRelation: "แม่",
  emergencyPhone: "0899999999",
  role: "mechanic",
  dayRateSatang: 50000,
  startedOn: Date.UTC(2026, 9, 1),
  bankName: "กสิกรไทย",
  bankAccountNo: "1234567890",
  bankAccountName: "สมชาย ใจดี",
  pin: "481920",
};

describe("POST /staff > the add form through the route", () => {
  it("given the add form with a PIN > then the route hands the PIN settings over and the person is added", async () => {
    // createStaff was tested directly; the route itself called it without the pepper and key,
    // so every PIN from the Expo add form came back pin_unavailable.
    const { raw, db } = withBoss();
    const token = (await createStaffSession(db, "boss", Date.now())).token;
    const env = { DB: db, STAFF_PIN_PEPPER: PEPPER, STAFF_SECRET_KEY: KEY } as unknown as Env;
    const res = await worker.fetch!(
      new Request("https://x/staff", {
        method: "POST",
        headers: { "X-Staff-Session": token, "content-type": "application/json" },
        body: JSON.stringify(ADD_FORM),
      }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(201);
    const { id } = (await json(res)) as { id: string };
    const row = raw.prepare(`SELECT pin_hash AS pinHash FROM users WHERE id = ?`).get(id) as {
      pinHash: string | null;
    };
    expect(row.pinHash).not.toBeNull();
  });
});

describe("createStaff > the whole add form in one request", () => {
  it("given the add form with no email and a PIN > then one person holds every field and can sign in by PIN", async () => {
    const { raw, db } = withBoss();
    const res = await createStaff(db, boss, ADD_FORM, NOW, PEPPER, KEY);
    expect(res.status).toBe(201);
    const { id } = (await json(res)) as { id: string };
    const row = raw
      .prepare(
        `SELECT name, name_th, name_en, full_name_th, full_name_en, email, phone, emergency_name,
                emergency_relation, emergency_phone, role, status, day_rate_satang, started_on,
                bank_name, bank_account_no, bank_account_name, created_by
           FROM users WHERE id = ?`,
      )
      .get(id);
    expect({ ...row }).toEqual({
      name: "บอย",
      name_th: "บอย",
      name_en: "Boy",
      full_name_th: "สมชาย ใจดี",
      full_name_en: "Somchai Jaidee",
      email: null,
      phone: "0812345678",
      emergency_name: "มาลี",
      emergency_relation: "แม่",
      emergency_phone: "0899999999",
      role: "mechanic",
      status: "active",
      day_rate_satang: 50000,
      started_on: Date.UTC(2026, 9, 1),
      bank_name: "กสิกรไทย",
      bank_account_no: "1234567890",
      bank_account_name: "สมชาย ใจดี",
      created_by: "boss",
    });
    const login = await loginWithPin(db, "481920", NOW + 1, PEPPER);
    expect(login.ok && login.identity.userId).toBe(id);
  });

  it("given no email and no PIN > then 400 pin_required_without_email on the PIN box, nobody saved", async () => {
    const { raw, db } = withBoss();
    const res = await createStaff(db, boss, { ...ADD_FORM, pin: undefined }, NOW, PEPPER, KEY);
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "pin_required_without_email", field: "pin" });
    expect(countUsers(raw)).toBe(1);
  });

  it("given no nickname > then 400 name_th_required", async () => {
    const { raw, db } = withBoss();
    const res = await createStaff(db, boss, { ...ADD_FORM, nameTh: " " }, NOW, PEPPER, KEY);
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "name_th_required", field: "nameTh" });
    expect(countUsers(raw)).toBe(1);
  });

  it("given no phone > then 400 phone_required", async () => {
    const { db } = withBoss();
    const res = await createStaff(db, boss, { ...ADD_FORM, phone: "" }, NOW, PEPPER, KEY);
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "phone_required", field: "phone" });
  });

  it("given a password but no email > then 400 password_without_email; it could never be used", async () => {
    const { raw, db } = withBoss();
    const res = await createStaff(
      db,
      boss,
      { ...ADD_FORM, password: "aircon-2026" },
      NOW,
      PEPPER,
      KEY,
    );
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "password_without_email", field: "password" });
    expect(countUsers(raw)).toBe(1);
  });

  it("given an email > then stored lower-cased, and a second person with it > 409 email_taken", async () => {
    const { raw, db } = withBoss();
    const first = await createStaff(
      db,
      boss,
      { ...ADD_FORM, email: " Boy@Shop.Test ", pin: undefined },
      NOW,
      PEPPER,
      KEY,
    );
    expect(first.status).toBe(201);
    const { id } = (await json(first)) as { id: string };
    expect(raw.prepare(`SELECT email FROM users WHERE id = ?`).get(id)).toEqual({
      email: "boy@shop.test",
    });
    const second = await createStaff(
      db,
      boss,
      { ...ADD_FORM, nameTh: "บอส", email: "BOY@shop.test", pin: undefined },
      NOW,
      PEPPER,
      KEY,
    );
    expect(second.status).toBe(409);
    expect(await json(second)).toMatchObject({ error: "email_taken", field: "email" });
  });

  it("given the email is taken between the check and the save > then 409 email_taken, not a crash", async () => {
    const { raw, db } = withBoss();
    raw
      .prepare(
        `INSERT INTO users (id, name, email, role, created_at) VALUES ('x', 'X', 'boy@shop.test', 'admin', ?)`,
      )
      .run(NOW);
    // The pre-check sees nobody (as it would if the other save landed a moment later); the unique
    // index is what refuses it.
    const blind = {
      prepare: (sql: string) =>
        sql.includes("lower(email) = ?")
          ? { bind: () => ({ first: async () => null }) }
          : db.prepare(sql),
      batch: db.batch.bind(db),
    } as unknown as D1Database;
    const res = await createStaff(
      blind,
      boss,
      { ...ADD_FORM, email: "boy@shop.test", pin: undefined },
      NOW,
      PEPPER,
      KEY,
    );
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({ error: "email_taken", field: "email" });
  });

  it("given a PIN somebody already holds > then 409 pin_taken, nobody saved", async () => {
    const { raw, db } = withBoss();
    expect((await createStaff(db, boss, ADD_FORM, NOW, PEPPER, KEY)).status).toBe(201);
    const res = await createStaff(db, boss, { ...ADD_FORM, nameTh: "บอส" }, NOW, PEPPER, KEY);
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({ error: "pin_taken", field: "pin" });
    expect(countUsers(raw)).toBe(2);
  });

  it("given a PIN that is not 6 digits > pin_format; an easy one > pin_too_easy", async () => {
    const { db } = withBoss();
    const short = await createStaff(db, boss, { ...ADD_FORM, pin: "12a4" }, NOW, PEPPER, KEY);
    expect(short.status).toBe(400);
    expect(await json(short)).toMatchObject({ error: "pin_format", field: "pin" });
    const easy = await createStaff(db, boss, { ...ADD_FORM, pin: "123456" }, NOW, PEPPER, KEY);
    expect(easy.status).toBe(400);
    expect(await json(easy)).toMatchObject({ error: "pin_too_easy", field: "pin" });
  });

  it("given a PIN while the PIN pepper is not configured > then 503 pin_unavailable", async () => {
    const { raw, db } = withBoss();
    const res = await createStaff(db, boss, ADD_FORM, NOW, "", KEY);
    expect(res.status).toBe(503);
    expect(await json(res)).toMatchObject({ error: "pin_unavailable" });
    expect(countUsers(raw)).toBe(1);
  });

  it("given a day rate that is not whole satang > then 400 day_rate_invalid", async () => {
    const { db } = withBoss();
    const res = await createStaff(db, boss, { ...ADD_FORM, dayRateSatang: 1.5 }, NOW, PEPPER, KEY);
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "day_rate_invalid", field: "dayRateSatang" });
  });

  it("given a start date that is not a day > then 400 started_on_invalid", async () => {
    const { db } = withBoss();
    const res = await createStaff(
      db,
      boss,
      { ...ADD_FORM, startedOn: "yesterday" as unknown as number },
      NOW,
      PEPPER,
      KEY,
    );
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "started_on_invalid", field: "startedOn" });
  });

  it("given an email and a password > then the owner can read the password back", async () => {
    const { db } = withBoss();
    const res = await createStaff(
      db,
      boss,
      { ...ADD_FORM, email: "boy@shop.test", pin: undefined, password: "aircon-2026" },
      NOW,
      PEPPER,
      KEY,
    );
    expect(res.status).toBe(201);
    const { id } = (await json(res)) as { id: string };
    expect(await json(await revealPassword(db, boss, id, KEY))).toEqual({
      password: "aircon-2026",
    });
  });

  it("given the old admin form {name, email, role} with no phone > then still created", async () => {
    const { db } = withBoss();
    const res = await createStaff(
      db,
      boss,
      { name: "Nok", nameTh: "นก", nameEn: "Nok", email: "nok@shop.test", role: "admin" },
      NOW,
    );
    expect(res.status).toBe(201);
    expect(await json(res)).toMatchObject({ name: "Nok", email: "nok@shop.test", role: "admin" });
  });

  it("given a role it does not know > then 400 role_invalid", async () => {
    const { db } = withBoss();
    const res = await createStaff(db, boss, { ...ADD_FORM, role: "wizard" }, NOW, PEPPER, KEY);
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "role_invalid", field: "role" });
  });

  it("given an admin, not the owner > then 403", async () => {
    const { db } = withBoss();
    expect((await createStaff(db, clerk, ADD_FORM, NOW, PEPPER, KEY)).status).toBe(403);
  });
});

describe("updateStaffProfile > the edit form", () => {
  /** Boss plus บอย, added through the add form (no email, a PIN). */
  async function withBoy() {
    const { raw, db } = withBoss();
    const res = await createStaff(db, boss, ADD_FORM, NOW, PEPPER, KEY);
    const { id } = (await json(res)) as { id: string };
    return { raw, db, id };
  }
  const read = (raw: DatabaseSync, id: string) =>
    raw
      .prepare(
        `SELECT email, full_name_th AS fullNameTh, full_name_en AS fullNameEn,
                emergency_relation AS emergencyRelation, phone
           FROM users WHERE id = ?`,
      )
      .get(id) as Record<string, unknown>;

  it("given the real names and the emergency relation > then stored", async () => {
    const { raw, db, id } = await withBoy();
    const res = await updateStaffProfile(
      db,
      boss,
      id,
      { fullNameTh: "สมชาย ดีมาก", fullNameEn: "Somchai Deemak", emergencyRelation: "พ่อ" },
      NOW,
    );
    expect(res.status).toBe(200);
    expect(read(raw, id)).toMatchObject({
      fullNameTh: "สมชาย ดีมาก",
      fullNameEn: "Somchai Deemak",
      emergencyRelation: "พ่อ",
    });
  });

  it("given only a phone > then the real names and relation are left exactly as they were", async () => {
    const { raw, db, id } = await withBoy();
    await updateStaffProfile(db, boss, id, { phone: "0800000000" }, NOW);
    expect(read(raw, id)).toEqual({
      email: null,
      fullNameTh: "สมชาย ใจดี",
      fullNameEn: "Somchai Jaidee",
      emergencyRelation: "แม่",
      phone: "0800000000",
    });
  });

  it("given an email > then stored lower-cased; given it blank again > then cleared", async () => {
    const { raw, db, id } = await withBoy();
    expect((await updateStaffProfile(db, boss, id, { email: " Boy@Shop.Test " }, NOW)).status).toBe(
      200,
    );
    expect(read(raw, id).email).toBe("boy@shop.test");
    expect((await updateStaffProfile(db, boss, id, { email: "" }, NOW)).status).toBe(200);
    expect(read(raw, id).email).toBeNull();
    expect((await updateStaffProfile(db, boss, id, { email: null }, NOW)).status).toBe(200);
    expect(read(raw, id).email).toBeNull();
  });

  it("given the email cleared for someone with no PIN > then 400 pin_required_without_email, kept", async () => {
    const { raw, db } = withBoss();
    raw
      .prepare(
        `INSERT INTO users (id, name, email, role, created_at) VALUES ('m1', 'M', 'm1@shop.test', 'mechanic', ?)`,
      )
      .run(NOW);
    const res = await updateStaffProfile(db, boss, "m1", { email: "" }, NOW);
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "pin_required_without_email", field: "pin" });
    expect(read(raw, "m1").email).toBe("m1@shop.test");
  });

  it("given an email somebody else has > then 409 email_taken on the email box", async () => {
    const { db, id } = await withBoy();
    const res = await updateStaffProfile(db, boss, id, { email: "BOSS@shop.test" }, NOW);
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({ error: "email_taken", field: "email" });
  });

  it("given the email is claimed between the check and the save > then 409 email_taken, not a crash", async () => {
    const { db, id } = await withBoy();
    const blind = {
      prepare: (sql: string) =>
        sql.includes("lower(email) = ?")
          ? { bind: () => ({ first: async () => null }) }
          : db.prepare(sql),
    } as unknown as D1Database;
    const res = await updateStaffProfile(blind, boss, id, { email: "boss@shop.test" }, NOW);
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({ error: "email_taken", field: "email" });
  });

  it("given a day rate that is not whole satang > then 400 day_rate_invalid", async () => {
    const { db, id } = await withBoy();
    const res = await updateStaffProfile(db, boss, id, { dayRateSatang: -5 }, NOW);
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "day_rate_invalid", field: "dayRateSatang" });
  });
});

describe("staff reads > the list and the person page carry what the app draws", () => {
  it("GET /staff > each person has nicknames, real names, phone, role, status, sign-in state and what is set", async () => {
    const { raw, db } = withBoss();
    const res = await createStaff(db, boss, ADD_FORM, NOW, PEPPER, KEY);
    const { id } = (await json(res)) as { id: string };
    raw
      .prepare(`UPDATE users SET locked_until = ?, last_login_at = ?, photo_key = ? WHERE id = ?`)
      .run(NOW + 1000, NOW - 1000, "staff-photo/x/y.jpg", id);
    const { staff } = (await json(await listStaff(db, boss))) as {
      staff: Record<string, unknown>[];
    };
    expect(staff.find((p) => p.id === id)).toEqual({
      id,
      name: "บอย",
      nameTh: "บอย",
      nameEn: "Boy",
      fullNameTh: "สมชาย ใจดี",
      fullNameEn: "Somchai Jaidee",
      email: null,
      phone: "0812345678",
      emergencyRelation: "แม่",
      role: "mechanic",
      status: "active",
      createdAt: NOW,
      lastLoginAt: NOW - 1000,
      lockedUntil: NOW + 1000,
      dayRateSatang: 50000,
      hasPhoto: 1,
      hasPin: 1,
      hasPassword: 0,
    });
    // The photo's storage key is not the list's business — the photo has its own route.
    expect(JSON.stringify(staff)).not.toContain("staff-photo/");
  });

  it("GET /staff/:id/profile > carries the real names, the relation and whether there is a photo", async () => {
    const { db } = withBoss();
    const res = await createStaff(db, boss, ADD_FORM, NOW, PEPPER, KEY);
    const { id } = (await json(res)) as { id: string };
    const { profile } = (await json(await staffProfileFor(db, boss, id, KEY))) as {
      profile: Record<string, unknown>;
    };
    expect(profile).toMatchObject({
      nameTh: "บอย",
      nameEn: "Boy",
      fullNameTh: "สมชาย ใจดี",
      fullNameEn: "Somchai Jaidee",
      emergencyName: "มาลี",
      emergencyRelation: "แม่",
      emergencyPhone: "0899999999",
      email: null,
      hasPhoto: 0,
      hasPin: 1,
      pin: "481920",
    });
    expect(JSON.stringify(profile)).not.toContain("photo_key");
  });
});

// ── A person's photo, through the real routes ───────────────────────────────────────────────────

/** An R2 double that keeps objects in memory, so a test can see what was stored and deleted. */
function memoryBucket() {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string | undefined }>();
  const bucket = {
    async put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
      objects.set(key, {
        bytes: new Uint8Array(value),
        contentType: opts?.httpMetadata?.contentType,
      });
    },
    async get(key: string) {
      const o = objects.get(key);
      return o ? { body: o.bytes, httpMetadata: { contentType: o.contentType } } : null;
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
  return { objects, bucket: bucket as unknown as R2Bucket };
}

describe("staff photo > PUT, GET, DELETE /staff/:id/photo", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

  async function setup() {
    const { raw, db } = withBoss();
    raw
      .prepare(
        `INSERT INTO users (id, name, email, role, created_at)
         VALUES ('m1', 'M', 'm1@shop.test', 'mechanic', ?), ('m2', 'N', 'm2@shop.test', 'mechanic', ?),
                ('a1', 'A', 'a1@shop.test', 'admin', ?)`,
      )
      .run(NOW, NOW, NOW);
    const { objects, bucket } = memoryBucket();
    const env = { DB: db, IMAGES: bucket } as unknown as Env;
    const tokens: Record<string, string> = {};
    for (const id of ["boss", "m1", "m2", "a1"]) {
      tokens[id] = (await createStaffSession(db, id, Date.now())).token;
    }
    const call = (as: string, method: string, path: string, body?: BodyInit, type?: string) =>
      worker.fetch!(
        new Request(`https://x${path}`, {
          method,
          headers: {
            "X-Staff-Session": tokens[as]!,
            ...(type ? { "content-type": type } : {}),
          },
          body,
        }),
        env,
        {} as ExecutionContext,
      );
    const photoKey = (id: string) =>
      (raw.prepare(`SELECT photo_key AS k FROM users WHERE id = ?`).get(id) as { k: string | null })
        .k;
    return { raw, db, objects, call, photoKey };
  }

  it("given a JPEG > then stored under staff-photo/<id>/ and served back, privately, to the owner", async () => {
    const { objects, call, photoKey } = await setup();
    const put = await call("boss", "PUT", "/staff/m1/photo", JPEG, "image/jpeg");
    expect(put.status).toBe(200);
    const key = photoKey("m1");
    expect(key).toMatch(/^staff-photo\/m1\/[0-9a-f-]{36}\.jpg$/);
    expect(objects.has(key!)).toBe(true);

    const got = await call("boss", "GET", "/staff/m1/photo");
    expect(got.status).toBe(200);
    expect(got.headers.get("content-type")).toBe("image/jpeg");
    expect(got.headers.get("cache-control")).toBe("private, max-age=60");
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(JPEG);
  });

  it("given a second photo > then the first image is deleted, not left behind", async () => {
    const { objects, call, photoKey } = await setup();
    await call("boss", "PUT", "/staff/m1/photo", JPEG, "image/jpeg");
    const first = photoKey("m1")!;
    await call("boss", "PUT", "/staff/m1/photo", new Uint8Array([9, 9, 9]), "image/png");
    const second = photoKey("m1")!;
    expect(second).not.toBe(first);
    expect([...objects.keys()]).toEqual([second]);
  });

  it("DELETE > then the photo is gone: the image, the key, and GET answers 404", async () => {
    const { objects, call, photoKey } = await setup();
    await call("boss", "PUT", "/staff/m1/photo", JPEG, "image/jpeg");
    const del = await call("boss", "DELETE", "/staff/m1/photo");
    expect(del.status).toBe(200);
    expect(photoKey("m1")).toBeNull();
    expect(objects.size).toBe(0);
    expect((await call("boss", "GET", "/staff/m1/photo")).status).toBe(404);
  });

  it("given an empty body, a non-image, an SVG or more than 5 MB > then 400 with its code, nothing stored", async () => {
    const { objects, call, photoKey } = await setup();
    const cases: [BodyInit, string, string][] = [
      [new Uint8Array(0), "image/jpeg", "photo_required"],
      [JPEG, "application/pdf", "photo_type"],
      [new TextEncoder().encode("<svg/>"), "image/svg+xml", "photo_type"],
      [new Uint8Array(5 * 1024 * 1024 + 1), "image/jpeg", "photo_too_large"],
    ];
    for (const [body, type, code] of cases) {
      const res = await call("boss", "PUT", "/staff/m1/photo", body, type);
      expect(res.status).toBe(400);
      expect(await json(res)).toMatchObject({ error: code, field: "photo" });
    }
    expect(objects.size).toBe(0);
    expect(photoKey("m1")).toBeNull();
  });

  it("given an admin > then PUT and DELETE are refused; the person may see their own photo, nobody else may", async () => {
    const { call } = await setup();
    expect((await call("a1", "PUT", "/staff/m1/photo", JPEG, "image/jpeg")).status).toBe(403);
    await call("boss", "PUT", "/staff/m1/photo", JPEG, "image/jpeg");
    expect((await call("a1", "DELETE", "/staff/m1/photo")).status).toBe(403);
    expect((await call("m1", "GET", "/staff/m1/photo")).status).toBe(200);
    expect((await call("m2", "GET", "/staff/m1/photo")).status).toBe(404);
    expect((await call("a1", "GET", "/staff/m1/photo")).status).toBe(404);
  });

  it("given someone with no photo, or nobody at all > then 404", async () => {
    const { call } = await setup();
    expect((await call("boss", "GET", "/staff/m1/photo")).status).toBe(404);
    expect((await call("boss", "PUT", "/staff/ghost/photo", JPEG, "image/jpeg")).status).toBe(404);
  });
});

// ── คนจ่าย — who handed the money over ──────────────────────────────────────────────────────────

describe("paidBy > who handed the money over", () => {
  const AUG = "2026-08";
  const CASH = { method: "cash", slipKey: null };
  const ADVANCE = { period: AUG, givenOn: "2026-08-10", amountSatang: 200000, method: "cash" };

  /** Boss (เลดี้), a second owner (กุ้ง), one switched off, one deleted, and the mechanic m1. */
  function seed() {
    const { raw, db } = withBoss();
    raw.prepare(`UPDATE users SET name_th = 'เลดี้' WHERE id = 'boss'`).run();
    const add = raw.prepare(
      `INSERT INTO users (id, name, name_th, email, role, status, created_at, deleted_at, day_rate_satang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    add.run("b2", "Kung", "กุ้ง", "b2@shop.test", "super_admin", "active", NOW, null, null);
    add.run("b3", "Off", null, "b3@shop.test", "super_admin", "disabled", NOW, null, null);
    add.run("b4", "Gone", null, null, "super_admin", "disabled", NOW, NOW, null);
    add.run("m1", "Boy", "บอย", "m1@shop.test", "mechanic", "active", NOW, null, 50000);
    add.run("m2", "Tum", "ตั้ม", "m2@shop.test", "mechanic", "active", NOW, null, 50000);
    return { raw, db };
  }
  const paidByOf = (raw: DatabaseSync, table: string) =>
    (raw.prepare(`SELECT paid_by AS p FROM ${table}`).get() as { p: string | null } | undefined)?.p;

  it("markSalaryPaid > given no payer > then the signed-in owner is recorded as คนจ่าย", async () => {
    const { raw, db } = seed();
    expect((await markSalaryPaid(db, boss, "m1", AUG, NOW, CASH)).status).toBe(200);
    expect(paidByOf(raw, "staff_payslips")).toBe("boss");
  });

  it("markSalaryPaid > given another active owner as payer > then they are recorded", async () => {
    const { raw, db } = seed();
    const res = await markSalaryPaid(db, boss, "m1", AUG, NOW, { ...CASH, paidBy: "b2" });
    expect(res.status).toBe(200);
    expect(paidByOf(raw, "staff_payslips")).toBe("b2");
  });

  it("markSalaryPaid > given a payer who is not an active owner > then 400 payer_invalid, not paid", async () => {
    const { raw, db } = seed();
    for (const paidBy of ["m2", "b3", "b4", "nobody"]) {
      const res = await markSalaryPaid(db, boss, "m1", AUG, NOW, { ...CASH, paidBy });
      expect(res.status).toBe(400);
      expect(await json(res)).toMatchObject({ error: "payer_invalid", field: "paidBy" });
    }
    expect(paidByOf(raw, "staff_payslips")).toBeUndefined();
  });

  it("recordAdvance > given no payer > the owner; given another owner > them; given a mechanic > 400", async () => {
    const { raw, db } = seed();
    expect((await recordAdvance(db, boss, "m1", ADVANCE, NOW)).status).toBe(200);
    expect(paidByOf(raw, "staff_advances")).toBe("boss");
    raw.exec(`DELETE FROM staff_advances`);

    expect((await recordAdvance(db, boss, "m1", { ...ADVANCE, paidBy: "b2" }, NOW)).status).toBe(
      200,
    );
    expect(paidByOf(raw, "staff_advances")).toBe("b2");
    raw.exec(`DELETE FROM staff_advances`);

    const res = await recordAdvance(db, boss, "m1", { ...ADVANCE, paidBy: "m2" }, NOW);
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "payer_invalid", field: "paidBy" });
    expect(paidByOf(raw, "staff_advances")).toBeUndefined();
  });

  it("the person page > the paid month and each advance carry the payer's name; an old row says null", async () => {
    const { raw, db } = seed();
    await recordAdvance(db, boss, "m1", { ...ADVANCE, paidBy: "b2" }, NOW);
    // An advance from before 0097, when nobody recorded who paid.
    raw
      .prepare(
        `INSERT INTO staff_advances (id, user_id, period, given_on, amount_satang, method, created_at)
         VALUES ('old', 'm1', ?, '2026-08-01', 100000, 'cash', ?)`,
      )
      .run(AUG, NOW);
    await markSalaryPaid(db, boss, "m1", AUG, NOW, CASH);

    const { payments } = (await json(await staffPayments(db, boss, "m1", AUG))) as {
      payments: {
        period: string;
        paidBy: string | null;
        advances: { id: string; paidBy: string | null }[];
      }[];
    };
    const aug = payments.find((p) => p.period === AUG)!;
    expect(aug.paidBy).toBe("เลดี้");
    expect(aug.advances.find((a) => a.id === "old")!.paidBy).toBeNull();
    expect(aug.advances.find((a) => a.id !== "old")!.paidBy).toBe("กุ้ง");

    const { advances } = (await json(await listAdvancesFor(db, boss, "m1", AUG))) as {
      advances: { id: string; paidBy: string | null }[];
    };
    expect(advances.find((a) => a.id !== "old")!.paidBy).toBe("กุ้ง");
    expect(advances.find((a) => a.id === "old")!.paidBy).toBeNull();
  });

  it("the person page > an unpaid month has no payer", async () => {
    const { db } = seed();
    const { payments } = (await json(await staffPayments(db, boss, "m1", AUG))) as {
      payments: { period: string; paidBy: string | null }[];
    };
    expect(payments.find((p) => p.period === AUG)!.paidBy).toBeNull();
  });
});

describe("salaryMonth > each row says what was advanced and what is left to hand over", () => {
  const AUG = "2026-08";

  function seed() {
    const { raw, db } = withBoss();
    raw.prepare(`UPDATE users SET name_th = 'เลดี้' WHERE id = 'boss'`).run();
    const add = raw.prepare(
      `INSERT INTO users (id, name, name_th, email, role, status, created_at, day_rate_satang)
       VALUES (?, ?, ?, ?, 'mechanic', 'active', ?, 50000)`,
    );
    add.run("m1", "Boy", "บอย", "m1@shop.test", NOW);
    add.run("m2", "Tum", "ตั้ม", "m2@shop.test", NOW);
    return { raw, db };
  }
  type Row = {
    userId: string;
    amountSatang: number;
    advanceSatang: number;
    dueSatang: number;
    owedSatang: number;
    paidAt: number | null;
    paidBy: string | null;
  };
  const rowsOf = async (db: D1Database) =>
    ((await json(await salaryMonth(db, boss, AUG))) as { rows: Row[] }).rows;

  it("given an unpaid month with advances > then the advances are summed off the wage", async () => {
    const { db } = seed();
    // ฿500 a day × 31 days = ฿15,500 earned; ฿2,000 + ฿1,000 taken early.
    for (const amountSatang of [200000, 100000]) {
      await recordAdvance(
        db,
        boss,
        "m1",
        { period: AUG, givenOn: "2026-08-10", amountSatang, method: "cash" },
        NOW,
      );
    }
    const m1 = (await rowsOf(db)).find((r) => r.userId === "m1")!;
    expect(m1).toMatchObject({
      amountSatang: 1550000,
      advanceSatang: 300000,
      dueSatang: 1250000,
      owedSatang: 0,
      paidAt: null,
      paidBy: null,
    });
    const m2 = (await rowsOf(db)).find((r) => r.userId === "m2")!;
    expect(m2).toMatchObject({ advanceSatang: 0, dueSatang: 1550000, owedSatang: 0 });
  });

  it("given a paid month > then the advance frozen on the payslip, and who paid it", async () => {
    const { raw, db } = seed();
    await recordAdvance(
      db,
      boss,
      "m1",
      { period: AUG, givenOn: "2026-08-10", amountSatang: 200000, method: "cash" },
      NOW,
    );
    await markSalaryPaid(db, boss, "m1", AUG, NOW, { method: "cash", slipKey: null });
    // A row slipped in after payment must not change what the paid month says.
    raw
      .prepare(
        `INSERT INTO staff_advances (id, user_id, period, given_on, amount_satang, method, created_at)
         VALUES ('late', 'm1', ?, '2026-08-30', 999900, 'cash', ?)`,
      )
      .run(AUG, NOW);
    const m1 = (await rowsOf(db)).find((r) => r.userId === "m1")!;
    expect(m1).toMatchObject({
      amountSatang: 1550000,
      advanceSatang: 200000,
      dueSatang: 1350000,
      owedSatang: 0,
      paidAt: NOW,
      paidBy: "เลดี้",
    });
  });

  it("given more advanced than earned > then nothing due and the excess owed", async () => {
    const { db } = seed();
    await recordAdvance(
      db,
      boss,
      "m1",
      { period: AUG, givenOn: "2026-08-10", amountSatang: 2000000, method: "cash" },
      NOW,
    );
    const m1 = (await rowsOf(db)).find((r) => r.userId === "m1")!;
    expect(m1).toMatchObject({ advanceSatang: 2000000, dueSatang: 0, owedSatang: 450000 });
  });
});

describe("POST /staff/:id/salary-paid > the payer and the optional cash photo", () => {
  const AUG = "2026-08";
  const PHOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 7, 7, 7]);

  async function setup(bucketOverride?: Partial<R2Bucket>) {
    const { raw, db } = withBoss();
    raw
      .prepare(
        `INSERT INTO users (id, name, email, role, status, created_at, day_rate_satang)
         VALUES ('m1', 'Boy', 'm1@shop.test', 'mechanic', 'active', ?, 50000),
                ('b2', 'Kung', 'b2@shop.test', 'super_admin', 'active', ?, NULL)`,
      )
      .run(NOW, NOW);
    const { objects, bucket } = memoryBucket();
    const env = { DB: db, IMAGES: { ...bucket, ...bucketOverride } } as unknown as Env;
    const token = (await createStaffSession(db, "boss", Date.now())).token;
    const call = (method: string, path: string, body?: BodyInit, type?: string) =>
      worker.fetch!(
        new Request(`https://x${path}`, {
          method,
          headers: { "X-Staff-Session": token, ...(type ? { "content-type": type } : {}) },
          body,
        }),
        env,
        {} as ExecutionContext,
      );
    const payslip = () =>
      raw
        .prepare(`SELECT slip_key AS slipKey, paid_by AS paidBy, method FROM staff_payslips`)
        .get() as { slipKey: string | null; paidBy: string | null; method: string } | undefined;
    return { raw, objects, call, payslip };
  }

  it("given ?paidBy= another active owner > then they are recorded as คนจ่าย", async () => {
    const { call, payslip } = await setup();
    const res = await call("POST", `/staff/m1/salary-paid?period=${AUG}&method=cash&paidBy=b2`);
    expect(res.status).toBe(200);
    expect(payslip()?.paidBy).toBe("b2");
  });

  it("given cash with a photo > then the photo is kept as the payslip's slip and served back", async () => {
    const { objects, call, payslip } = await setup();
    const res = await call(
      "POST",
      `/staff/m1/salary-paid?period=${AUG}&method=cash`,
      PHOTO,
      "image/jpeg",
    );
    expect(res.status).toBe(200);
    const slip = payslip()!;
    expect(slip.method).toBe("cash");
    expect(slip.slipKey).toMatch(/^salary-slip\/m1\/2026-08\/[0-9a-f-]{36}\.jpg$/);
    expect(objects.has(slip.slipKey!)).toBe(true);

    const got = await call("GET", `/staff/m1/salary-slip?period=${AUG}`);
    expect(got.status).toBe(200);
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(PHOTO);
    const { payments } = (await json(await call("GET", `/staff/m1/payments?month=${AUG}`))) as {
      payments: { period: string; hasSlip: boolean }[];
    };
    expect(payments.find((p) => p.period === AUG)!.hasSlip).toBe(true);
  });

  it("given cash with no body > then paid exactly as before, no slip", async () => {
    const { objects, call, payslip } = await setup();
    const res = await call("POST", `/staff/m1/salary-paid?period=${AUG}&method=cash`);
    expect(res.status).toBe(200);
    expect(payslip()?.slipKey).toBeNull();
    expect(objects.size).toBe(0);
  });

  it("given cash with a body that is not an image > then 400 and not paid", async () => {
    const { objects, call, payslip } = await setup();
    const res = await call(
      "POST",
      `/staff/m1/salary-paid?period=${AUG}&method=cash`,
      "hello",
      "text/plain",
    );
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: "photo_type", field: "photo" });
    expect(payslip()).toBeUndefined();
    expect(objects.size).toBe(0);
  });

  it("given a transfer with no slip > then still refused", async () => {
    const { call, payslip } = await setup();
    const res = await call("POST", `/staff/m1/salary-paid?period=${AUG}&method=transfer`);
    expect(res.status).toBe(400);
    expect(payslip()).toBeUndefined();
  });

  it("given the cash photo fails to store > then no payslip claims it", async () => {
    const { call, payslip } = await setup({
      put: async () => {
        throw new Error("R2 down");
      },
    });
    const res = await call(
      "POST",
      `/staff/m1/salary-paid?period=${AUG}&method=cash`,
      PHOTO,
      "image/jpeg",
    );
    expect(res.status).toBe(500);
    expect(payslip()).toBeUndefined();
  });
});

// ── "เข้าใช้งานผิด 3 ครั้ง — ล็อก" in the work history ────────────────────────────────────────

describe("sign-in lock > one 'locked' line in the work history per lock", () => {
  async function seedPerson() {
    const { raw, db } = withBoss();
    const stored = await hashPassword("correct-horse", { iterations: 1000 });
    raw
      .prepare(
        `INSERT INTO users (id, name, email, role, status, created_at,
                            password_hash, password_salt, password_iterations)
         VALUES ('m1', 'Boy', 'boy@shop.test', 'mechanic', 'active', ?, ?, ?, ?)`,
      )
      .run(NOW, stored.hash, stored.salt, stored.iterations);
    expect((await setStaffPin(db, boss, "m1", "481920", NOW, PEPPER, KEY)).status).toBe(200);
    raw.exec(`DELETE FROM staff_activity`); // the PIN reset's own line is not what is under test
    return { raw, db };
  }
  const lockedRows = (raw: DatabaseSync) =>
    raw
      .prepare(
        `SELECT user_id AS userId, kind, detail, created_at AS createdAt
           FROM staff_activity WHERE kind = 'locked'`,
      )
      .all()
      .map((r) => ({ ...r }));

  it("given three wrong passwords in a row > then exactly one 'locked' row, at the moment of the lock", async () => {
    const { raw, db } = await seedPerson();
    for (let i = 0; i < LOCK_AFTER_FAILURES; i++) {
      await loginStaff(db, "boy@shop.test", "wrong", NOW + i);
    }
    // More tries while locked change nothing — they never reach the counter.
    await loginStaff(db, "boy@shop.test", "wrong", NOW + 10);
    await loginStaff(db, "boy@shop.test", "correct-horse", NOW + 11);
    expect(lockedRows(raw)).toEqual([
      { userId: "m1", kind: "locked", detail: null, createdAt: NOW + LOCK_AFTER_FAILURES - 1 },
    ]);
  });

  it("given the failure that crosses the line comes through the PIN door > then the same single row", async () => {
    const { raw, db } = await seedPerson();
    // A PIN failure reaches an account only when the PIN finds the row but its slow hash says no.
    // Swap the slow hash for another PIN's so 481920 lands on บอย and fails there.
    const other = await hashPassword("905172", { iterations: 1000 });
    raw
      .prepare(`UPDATE users SET pin_hash = ?, pin_salt = ?, pin_iterations = ? WHERE id = 'm1'`)
      .run(other.hash, other.salt, other.iterations);
    await loginStaff(db, "boy@shop.test", "wrong", NOW);
    await loginStaff(db, "boy@shop.test", "wrong", NOW + 1);
    expect(lockedRows(raw)).toEqual([]);
    expect(await loginWithPin(db, "481920", NOW + 2, PEPPER)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(lockedRows(raw)).toEqual([
      { userId: "m1", kind: "locked", detail: null, createdAt: NOW + 2 },
    ]);
    // Locked now, through either door — and no second row for the tries that bounce off it.
    expect(await loginWithPin(db, "481920", NOW + 3, PEPPER)).toEqual({
      ok: false,
      reason: "locked",
    });
    expect(lockedRows(raw)).toHaveLength(1);
  });

  it("given failures that do not reach the lock > then no 'locked' row", async () => {
    const { raw, db } = await seedPerson();
    for (let i = 0; i < LOCK_AFTER_FAILURES - 1; i++) {
      await loginStaff(db, "boy@shop.test", "wrong", NOW + i);
    }
    expect(lockedRows(raw)).toEqual([]);
  });

  it("given the activity log cannot be written > then the sign-in still answers 'invalid' and the lock still holds", async () => {
    const { raw, db } = await seedPerson();
    raw.exec(`DROP TABLE staff_activity`);
    for (let i = 0; i < LOCK_AFTER_FAILURES; i++) {
      const out = await loginStaff(db, "boy@shop.test", "wrong", NOW + i);
      expect(out).toEqual({ ok: false, reason: "invalid" });
    }
    const out = await loginStaff(db, "boy@shop.test", "correct-horse", NOW + 10);
    expect(out).toEqual({ ok: false, reason: "locked" });
  });
});
