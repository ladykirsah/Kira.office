import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  recordDayOff,
  recordDayOffFor,
  listMyDaysOff,
  listTeamDaysOff,
  deleteDayOff,
  updateDayOff,
} from "./staffRoutes";
import type { StaffIdentity } from "./staffSession";

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

function seedUser(db: DatabaseSync, id: string, role: string, name = id) {
  db.prepare(
    `INSERT INTO users (id, name, email, role, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)`,
  ).run(id, name, `${id}@shop.local`, role, NOW);
}

const who = (userId: string, role: string): StaffIdentity =>
  ({ userId, email: `${userId}@shop.local`, name: userId, role }) as StaffIdentity;

const body = async (res: Response) => (await res.json()) as Record<string, never>;

describe("recordDayOff > leave modes", () => {
  it("given เข้าสาย (0 halves) > then it is accepted and costs nothing", async () => {
    // The mode that exists purely as a record. Payroll subtracts `halves`, so 0 must be storable —
    // rejecting it here is what would have forced a migration or a second table.
    const db = migratedDb();
    seedUser(db, "u1", "mechanic");
    const res = await recordDayOff(
      asD1(db),
      who("u1", "mechanic"),
      { day: "2026-08-11", halves: 0, reason: "รถติด" },
      NOW,
    );
    expect(res.status).toBe(201);
    const row = db.prepare(`SELECT halves, reason FROM staff_days_off WHERE user_id='u1'`).get();
    expect(row).toMatchObject({ halves: 0, reason: "รถติด" });
  });

  it("given a mode the shop does not offer > then it is refused before it reaches payroll", async () => {
    const db = migratedDb();
    seedUser(db, "u1", "mechanic");
    for (const halves of [3, -1, 0.5]) {
      const res = await recordDayOff(
        asD1(db),
        who("u1", "mechanic"),
        { day: "2026-08-11", halves },
        NOW,
      );
      expect(res.status).toBe(400);
    }
    expect(db.prepare(`SELECT COUNT(*) AS n FROM staff_days_off`).get()).toMatchObject({ n: 0 });
  });

  it("given the same day twice > then it REPLACES, so a day is never counted twice", async () => {
    const db = migratedDb();
    seedUser(db, "u1", "mechanic");
    const d1 = asD1(db);
    await recordDayOff(d1, who("u1", "mechanic"), { day: "2026-08-11", halves: 2 }, NOW);
    await recordDayOff(d1, who("u1", "mechanic"), { day: "2026-08-11", halves: 1 }, NOW);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM staff_days_off`).get()).toMatchObject({ n: 1 });
    expect(db.prepare(`SELECT halves FROM staff_days_off`).get()).toMatchObject({ halves: 1 });
  });

  it("given a date in the past > then it is allowed; people forget to record on the day", async () => {
    const db = migratedDb();
    seedUser(db, "u1", "mechanic");
    const res = await recordDayOff(
      asD1(db),
      who("u1", "mechanic"),
      { day: "2020-01-05", halves: 2 },
      NOW,
    );
    expect(res.status).toBe(201);
  });
});

describe("recordDayOffFor > super admin records on someone's behalf", () => {
  it("given a super admin > then the row belongs to the STAFF, and records who typed it", async () => {
    // user_id is whose day off it is; created_by is who entered it. Conflating them would credit
    // the owner's own month with the mechanic's absence.
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const res = await recordDayOffFor(
      asD1(db),
      who("boss", "super_admin"),
      "u1",
      { day: "2026-08-05", halves: 2, reason: "ปวดหลัง" },
      NOW,
    );
    expect(res.status).toBe(201);
    expect(db.prepare(`SELECT user_id, created_by FROM staff_days_off`).get()).toMatchObject({
      user_id: "u1",
      created_by: "boss",
    });
  });

  it("given a mechanic trying it > then 403, even for their own id", async () => {
    const db = migratedDb();
    seedUser(db, "u1", "mechanic");
    const res = await recordDayOffFor(
      asD1(db),
      who("u1", "mechanic"),
      "u1",
      { day: "2026-08-05", halves: 2 },
      NOW,
    );
    expect(res.status).toBe(403);
  });

  it("given an unknown staff id > then 404 rather than an orphan row", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    const res = await recordDayOffFor(
      asD1(db),
      who("boss", "super_admin"),
      "ghost",
      { day: "2026-08-05", halves: 2 },
      NOW,
    );
    expect(res.status).toBe(404);
  });
});

describe("deleteDayOff > only a super admin may delete", () => {
  async function seedOne(db: DatabaseSync) {
    seedUser(db, "u1", "mechanic");
    seedUser(db, "boss", "super_admin");
    await recordDayOff(asD1(db), who("u1", "mechanic"), { day: "2026-08-11", halves: 2 }, NOW);
    return db.prepare(`SELECT id FROM staff_days_off`).get() as { id: string };
  }

  it("given the staff member who owns the row > then 403 — they may edit, never delete", async () => {
    // The owner's rule (5 Aug 2026). Editing keeps a record of the day; deleting erases that it was
    // ever claimed, which is the part only the owner should be able to do.
    const db = migratedDb();
    const { id } = await seedOne(db);
    const res = await deleteDayOff(asD1(db), who("u1", "mechanic"), id);
    expect(res.status).toBe(403);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM staff_days_off`).get()).toMatchObject({ n: 1 });
  });

  it("given an admin (not super) > then 403 too", async () => {
    const db = migratedDb();
    const { id } = await seedOne(db);
    seedUser(db, "a1", "admin");
    expect((await deleteDayOff(asD1(db), who("a1", "admin"), id)).status).toBe(403);
  });

  it("given a super admin > then the row is gone", async () => {
    const db = migratedDb();
    const { id } = await seedOne(db);
    const res = await deleteDayOff(asD1(db), who("boss", "super_admin"), id);
    expect(res.status).toBe(200);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM staff_days_off`).get()).toMatchObject({ n: 0 });
  });

  it("given an id that does not exist > then 404", async () => {
    const db = migratedDb();
    await seedOne(db);
    expect((await deleteDayOff(asD1(db), who("boss", "super_admin"), "nope")).status).toBe(404);
  });
});

describe("listMyDaysOff", () => {
  it("given a month > then only that month, newest first, and only MY rows", async () => {
    const db = migratedDb();
    seedUser(db, "u1", "mechanic");
    seedUser(db, "u2", "mechanic");
    const d1 = asD1(db);
    await recordDayOff(d1, who("u1", "mechanic"), { day: "2026-08-02", halves: 2 }, NOW);
    await recordDayOff(d1, who("u1", "mechanic"), { day: "2026-08-14", halves: 1 }, NOW);
    await recordDayOff(d1, who("u1", "mechanic"), { day: "2026-07-30", halves: 2 }, NOW);
    await recordDayOff(d1, who("u2", "mechanic"), { day: "2026-08-09", halves: 2 }, NOW);

    const res = await listMyDaysOff(d1, who("u1", "mechanic"), "2026-08");
    const { days } = (await body(res)) as unknown as { days: { day: string }[] };
    expect(days.map((d) => d.day)).toEqual(["2026-08-14", "2026-08-02"]);
  });
});

describe("listTeamDaysOff", () => {
  it("given a super admin > then everyone's rows for the month, with their names", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic", "สมชาย");
    seedUser(db, "u2", "admin", "น้ำฝน");
    const d1 = asD1(db);
    await recordDayOff(d1, who("u1", "mechanic"), { day: "2026-08-14", halves: 2 }, NOW);
    await recordDayOff(d1, who("u2", "admin"), { day: "2026-08-09", halves: 1 }, NOW);

    const res = await listTeamDaysOff(d1, who("boss", "super_admin"), "2026-08");
    const { days } = (await body(res)) as unknown as { days: { name: string; day: string }[] };
    expect(days).toHaveLength(2);
    expect(days.map((d) => d.name).sort()).toEqual(["น้ำฝน", "สมชาย"]);
  });

  it("given a mechanic > then 403; who else is off is not theirs to read", async () => {
    const db = migratedDb();
    seedUser(db, "u1", "mechanic");
    expect((await listTeamDaysOff(asD1(db), who("u1", "mechanic"), "2026-08")).status).toBe(403);
  });
});

describe("updateDayOff > editing a row in place", () => {
  async function seedMine(db: DatabaseSync) {
    seedUser(db, "u1", "mechanic");
    seedUser(db, "boss", "super_admin");
    await recordDayOff(asD1(db), who("u1", "mechanic"), { day: "2026-08-11", halves: 2 }, NOW);
    return db.prepare(`SELECT id FROM staff_days_off`).get() as { id: string };
  }

  it("given a new date > then the row MOVES; it does not leave the old day behind", async () => {
    // The whole reason this exists rather than reusing the upsert. An upsert keyed on (person, day)
    // would write a row for the new date and strand the old one — and staff cannot delete, so they
    // would be stuck with a day off they never took, silently costing them a day's wage.
    const db = migratedDb();
    const { id } = await seedMine(db);
    const res = await updateDayOff(
      asD1(db),
      who("u1", "mechanic"),
      id,
      { day: "2026-08-12", halves: 1, reason: "ย้ายวัน" },
      NOW,
    );
    expect(res.status).toBe(200);
    const rows = db.prepare(`SELECT day, halves, reason FROM staff_days_off`).all();
    expect(rows).toEqual([{ day: "2026-08-12", halves: 1, reason: "ย้ายวัน" }]);
  });

  it("given a move onto a day they already have > then 409, never a silent overwrite", async () => {
    // Overwriting would destroy the other row — deletion by another name, which is exactly the
    // power staff are not supposed to have.
    const db = migratedDb();
    const { id } = await seedMine(db);
    await recordDayOff(asD1(db), who("u1", "mechanic"), { day: "2026-08-20", halves: 2 }, NOW);
    const res = await updateDayOff(
      asD1(db),
      who("u1", "mechanic"),
      id,
      { day: "2026-08-20", halves: 2 },
      NOW,
    );
    expect(res.status).toBe(409);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM staff_days_off`).get()).toMatchObject({ n: 2 });
  });

  it("given somebody else's row > then 403, even though editing is otherwise allowed", async () => {
    const db = migratedDb();
    const { id } = await seedMine(db);
    seedUser(db, "u2", "mechanic");
    const res = await updateDayOff(
      asD1(db),
      who("u2", "mechanic"),
      id,
      { day: "2026-08-12", halves: 2 },
      NOW,
    );
    expect(res.status).toBe(403);
  });

  it("given a super admin > then they may edit anyone's row", async () => {
    const db = migratedDb();
    const { id } = await seedMine(db);
    const res = await updateDayOff(
      asD1(db),
      who("boss", "super_admin"),
      id,
      { day: "2026-08-11", halves: 0, reason: "มาสาย" },
      NOW,
    );
    expect(res.status).toBe(200);
    expect(db.prepare(`SELECT halves FROM staff_days_off`).get()).toMatchObject({ halves: 0 });
  });

  it("given an invalid mode > then 400 and the row is untouched", async () => {
    const db = migratedDb();
    const { id } = await seedMine(db);
    const res = await updateDayOff(
      asD1(db),
      who("u1", "mechanic"),
      id,
      { day: "2026-08-11", halves: 7 },
      NOW,
    );
    expect(res.status).toBe(400);
    expect(db.prepare(`SELECT halves FROM staff_days_off`).get()).toMatchObject({ halves: 2 });
  });
});
