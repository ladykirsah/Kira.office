import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  recordAdvance,
  listAdvancesFor,
  deleteAdvance,
  staffPayments,
  markSalaryPaid,
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
    `INSERT INTO users (id, name, email, role, status, created_at, day_rate_satang)
     VALUES (?, ?, ?, ?, 'active', ?, 50000)`,
  ).run(id, name, `${id}@shop.local`, role, NOW);
}

const who = (userId: string, role: string): StaffIdentity =>
  ({ userId, email: `${userId}@shop.local`, name: userId, role }) as StaffIdentity;

const body = async (res: Response) => (await res.json()) as Record<string, never>;

const GOOD = {
  period: "2026-08",
  givenOn: "2026-08-22",
  amountSatang: 300000,
  method: "cash",
  note: "ขอเบิกก่อนเปิดเทอม",
};

/**
 * เงินเบิกล่วงหน้า — salary handed over before payday (owner, 2026-08-24).
 *
 * Money leaving the shop, so it is the super admin's alone to record and to remove; staff read their
 * own totals but never write one. The slip rule is the same as for the wage itself and is not
 * re-derived here — `payoutProblem` in core owns it, so the advance form and the wage form can
 * never drift into disagreeing about what counts as proof.
 */
describe("recordAdvance", () => {
  it("given cash with no slip > then recorded", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const res = await recordAdvance(asD1(db), who("boss", "super_admin"), "u1", GOOD, NOW);
    expect(res.status).toBe(200);
    const row = db.prepare(`SELECT * FROM staff_advances`).get() as Record<string, unknown>;
    expect(row.user_id).toBe("u1");
    expect(row.period).toBe("2026-08");
    expect(row.given_on).toBe("2026-08-22");
    expect(row.amount_satang).toBe(300000);
    expect(row.method).toBe("cash");
    expect(row.created_by).toBe("boss");
  });

  it("given a transfer WITHOUT a slip > then refused, in core's words", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const res = await recordAdvance(
      asD1(db),
      who("boss", "super_admin"),
      "u1",
      { ...GOOD, method: "transfer", slipKey: null },
      NOW,
    );
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("a transfer needs its slip attached");
    expect((db.prepare(`SELECT COUNT(*) AS n FROM staff_advances`).get() as { n: number }).n).toBe(
      0,
    );
  });

  it("given a transfer WITH a slip > then recorded", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const res = await recordAdvance(
      asD1(db),
      who("boss", "super_admin"),
      "u1",
      { ...GOOD, method: "transfer", slipKey: "slips/a.jpg" },
      NOW,
    );
    expect(res.status).toBe(200);
    expect(
      (db.prepare(`SELECT slip_key FROM staff_advances`).get() as { slip_key: string }).slip_key,
    ).toBe("slips/a.jpg");
  });

  it("given a zero or negative amount > then refused; that is not an advance", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    for (const amountSatang of [0, -1, -300000]) {
      const res = await recordAdvance(
        asD1(db),
        who("boss", "super_admin"),
        "u1",
        { ...GOOD, amountSatang },
        NOW,
      );
      expect(res.status, String(amountSatang)).toBe(400);
    }
  });

  it("given a malformed date or period > then refused rather than filed somewhere odd", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const d1 = asD1(db);
    expect(
      (
        await recordAdvance(
          d1,
          who("boss", "super_admin"),
          "u1",
          { ...GOOD, givenOn: "22/08/2026" },
          NOW,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await recordAdvance(
          d1,
          who("boss", "super_admin"),
          "u1",
          { ...GOOD, period: "2026-8" },
          NOW,
        )
      ).status,
    ).toBe(400);
  });

  it("given an admin or a mechanic > then 403; this is money", async () => {
    const db = migratedDb();
    seedUser(db, "a1", "admin");
    seedUser(db, "u1", "mechanic");
    const d1 = asD1(db);
    expect((await recordAdvance(d1, who("a1", "admin"), "u1", GOOD, NOW)).status).toBe(403);
    expect((await recordAdvance(d1, who("u1", "mechanic"), "u1", GOOD, NOW)).status).toBe(403);
  });

  it("given no such person > then 404", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    expect(
      (await recordAdvance(asD1(db), who("boss", "super_admin"), "ghost", GOOD, NOW)).status,
    ).toBe(404);
  });

  it("given a month already PAID > then refused — a paid month is a record, not a running total", async () => {
    // The payslip froze the advance figure at the moment of payment. Letting one in afterwards
    // would leave the payslip and the advance list disagreeing, with no way to tell which lied.
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    db.prepare(
      `INSERT INTO staff_payslips (id, user_id, period, day_rate_satang, days_in_month,
                                   off_halves, working_halves, amount_satang, paid_at, created_at)
       VALUES ('ps1','u1','2026-08',50000,31,0,62,1550000,?,?)`,
    ).run(NOW, NOW);
    const res = await recordAdvance(asD1(db), who("boss", "super_admin"), "u1", GOOD, NOW);
    expect(res.status).toBe(409);
    expect((await body(res)).error).toContain("already been paid");
  });
});

describe("listAdvancesFor", () => {
  it("given a month > then that person's advances newest first, with the total", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    seedUser(db, "u2", "mechanic");
    const d1 = asD1(db);
    const boss = who("boss", "super_admin");
    await recordAdvance(
      d1,
      boss,
      "u1",
      { ...GOOD, givenOn: "2026-08-12", amountSatang: 300000 },
      NOW,
    );
    await recordAdvance(
      d1,
      boss,
      "u1",
      { ...GOOD, givenOn: "2026-08-22", amountSatang: 200000 },
      NOW,
    );
    await recordAdvance(
      d1,
      boss,
      "u1",
      { ...GOOD, period: "2026-07", givenOn: "2026-07-10", amountSatang: 999900 },
      NOW,
    );
    await recordAdvance(d1, boss, "u2", GOOD, NOW);

    const res = await listAdvancesFor(d1, boss, "u1", "2026-08");
    const out = (await body(res)) as unknown as {
      advances: { givenOn: string; amountSatang: number }[];
      totalSatang: number;
    };
    expect(out.advances.map((a) => a.givenOn)).toEqual(["2026-08-22", "2026-08-12"]);
    expect(out.totalSatang).toBe(500000);
  });

  it("given a month with none > then an empty list and a zero total", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const out = (await body(
      await listAdvancesFor(asD1(db), who("boss", "super_admin"), "u1", "2026-08"),
    )) as unknown as { advances: unknown[]; totalSatang: number };
    expect(out).toEqual({ advances: [], totalSatang: 0 });
  });

  it("given an admin > then 403", async () => {
    const db = migratedDb();
    seedUser(db, "a1", "admin");
    seedUser(db, "u1", "mechanic");
    expect((await listAdvancesFor(asD1(db), who("a1", "admin"), "u1", "2026-08")).status).toBe(403);
  });
});

describe("deleteAdvance", () => {
  it("given the super admin > then it is gone", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const d1 = asD1(db);
    await recordAdvance(d1, who("boss", "super_admin"), "u1", GOOD, NOW);
    const id = (db.prepare(`SELECT id FROM staff_advances`).get() as { id: string }).id;
    expect((await deleteAdvance(d1, who("boss", "super_admin"), id)).status).toBe(200);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM staff_advances`).get() as { n: number }).n).toBe(
      0,
    );
  });

  it("given an admin > then 403 and it stays", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "a1", "admin");
    seedUser(db, "u1", "mechanic");
    const d1 = asD1(db);
    await recordAdvance(d1, who("boss", "super_admin"), "u1", GOOD, NOW);
    const id = (db.prepare(`SELECT id FROM staff_advances`).get() as { id: string }).id;
    expect((await deleteAdvance(d1, who("a1", "admin"), id)).status).toBe(403);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM staff_advances`).get() as { n: number }).n).toBe(
      1,
    );
  });

  it("given an id that is not there > then 404", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    expect((await deleteAdvance(asD1(db), who("boss", "super_admin"), "nope")).status).toBe(404);
  });
});

/**
 * The wage history, once advances exist.
 *
 * It used to list PAID months only, which was fine when a month's figure could not change before
 * payday. An advance changes it the moment it is handed over, so the month you are standing in has
 * to be on the table too — otherwise the one number you want, "what do I owe on the 5th", is the
 * one number the page will not show you.
 *
 * A PAID month reports what the payslip froze. An unpaid one is computed live. Never the reverse:
 * recomputing a paid month is how a September raise, or a September advance, would rewrite what
 * August actually handed over.
 */
describe("staffPayments > salary and advances in one table", () => {
  const AUG = "2026-08";

  it("given an unpaid month with advances > then earned, advance and what is still due", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const d1 = asD1(db);
    const boss = who("boss", "super_admin");
    // ฿500/day × 31 days = ฿15,500 earned; ฿3,000 taken early.
    await recordAdvance(d1, boss, "u1", { ...GOOD, amountSatang: 300000 }, NOW);

    const out = (await body(await staffPayments(d1, boss, "u1", AUG))) as unknown as {
      payments: {
        period: string;
        earnedSatang: number;
        advanceSatang: number;
        dueSatang: number;
        owedSatang: number;
        paidAt: number | null;
      }[];
    };
    const aug = out.payments.find((p) => p.period === AUG)!;
    expect(aug.earnedSatang).toBe(1550000);
    expect(aug.advanceSatang).toBe(300000);
    expect(aug.dueSatang).toBe(1250000);
    expect(aug.owedSatang).toBe(0);
    expect(aug.paidAt).toBeNull();
  });

  it("given MORE advance than the month earns > then ฿0 due and the excess owed", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const d1 = asD1(db);
    const boss = who("boss", "super_admin");
    await recordAdvance(d1, boss, "u1", { ...GOOD, amountSatang: 2000000 }, NOW);

    const out = (await body(await staffPayments(d1, boss, "u1", AUG))) as unknown as {
      payments: { period: string; dueSatang: number; owedSatang: number }[];
    };
    const aug = out.payments.find((p) => p.period === AUG)!;
    expect(aug.dueSatang).toBe(0);
    expect(aug.owedSatang).toBe(450000); // 20,000 − 15,500
  });

  it("given a PAID month > then the frozen figures, not today's", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    db.prepare(
      `INSERT INTO staff_payslips (id, user_id, period, day_rate_satang, days_in_month, off_halves,
                                   working_halves, amount_satang, advance_satang, method,
                                   paid_at, created_at, slip_key)
       VALUES ('ps1','u1','2026-07',40000,31,0,62,1240000,200000,'cash',?,?,NULL)`,
    ).run(NOW, NOW);
    // The rate has since risen to ฿500 — July must not follow it.
    const out = (await body(
      await staffPayments(asD1(db), who("boss", "super_admin"), "u1", AUG),
    )) as unknown as {
      payments: {
        period: string;
        dayRateSatang: number;
        earnedSatang: number;
        advanceSatang: number;
        dueSatang: number;
        method: string | null;
      }[];
    };
    const jul = out.payments.find((p) => p.period === "2026-07")!;
    expect(jul.dayRateSatang).toBe(40000);
    expect(jul.earnedSatang).toBe(1240000);
    expect(jul.advanceSatang).toBe(200000);
    expect(jul.dueSatang).toBe(1040000);
    expect(jul.method).toBe("cash");
  });

  it("given the person themselves > then they may read it", async () => {
    const db = migratedDb();
    seedUser(db, "u1", "mechanic");
    expect((await staffPayments(asD1(db), who("u1", "mechanic"), "u1", AUG)).status).toBe(200);
  });

  it("given somebody else's mechanic > then 403", async () => {
    const db = migratedDb();
    seedUser(db, "u1", "mechanic");
    seedUser(db, "u2", "mechanic");
    expect((await staffPayments(asD1(db), who("u2", "mechanic"), "u1", AUG)).status).toBe(403);
  });
});

/**
 * Marking the wage itself paid.
 *
 * CHANGED 2026-08-24: a slip used to be required unconditionally, which is wrong for a shop that
 * mostly hands over cash — it pushed people into not recording the payment, or attaching something
 * meaningless to get past the form. Now it follows the same rule as an advance: cash needs nothing,
 * a transfer needs its slip. The month's advances are frozen onto the payslip at the same moment,
 * for the same reason the day rate is.
 */
describe("markSalaryPaid > cash needs no slip, a transfer does", () => {
  it("given cash with no slip > then paid, and the advances are frozen onto the payslip", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const d1 = asD1(db);
    const boss = who("boss", "super_admin");
    await recordAdvance(d1, boss, "u1", { ...GOOD, amountSatang: 300000 }, NOW);

    const res = await markSalaryPaid(d1, boss, "u1", "2026-08", NOW, {
      method: "cash",
      slipKey: null,
      paidOn: "2026-09-05",
    });
    expect(res.status).toBe(200);
    const ps = db.prepare(`SELECT * FROM staff_payslips`).get() as Record<string, number | string>;
    expect(ps.amount_satang).toBe(1550000);
    expect(ps.advance_satang).toBe(300000);
    expect(ps.method).toBe("cash");
    // What actually changed hands: 15,500 − 3,000.
    expect((await body(res)).dueSatang).toBe(1250000);
  });

  it("given a transfer with no slip > then refused, in core's words", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const res = await markSalaryPaid(asD1(db), who("boss", "super_admin"), "u1", "2026-08", NOW, {
      method: "transfer",
      slipKey: null,
      paidOn: "2026-09-05",
    });
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("a transfer needs its slip attached");
    expect((db.prepare(`SELECT COUNT(*) AS n FROM staff_payslips`).get() as { n: number }).n).toBe(
      0,
    );
  });

  it("given a transfer with a slip > then paid", async () => {
    const db = migratedDb();
    seedUser(db, "boss", "super_admin");
    seedUser(db, "u1", "mechanic");
    const res = await markSalaryPaid(asD1(db), who("boss", "super_admin"), "u1", "2026-08", NOW, {
      method: "transfer",
      slipKey: "slips/x.jpg",
      paidOn: "2026-09-05",
    });
    expect(res.status).toBe(200);
    expect(
      (db.prepare(`SELECT slip_key FROM staff_payslips`).get() as { slip_key: string }).slip_key,
    ).toBe("slips/x.jpg");
  });

  it("given an admin > then 403", async () => {
    const db = migratedDb();
    seedUser(db, "a1", "admin");
    seedUser(db, "u1", "mechanic");
    expect(
      (
        await markSalaryPaid(asD1(db), who("a1", "admin"), "u1", "2026-08", NOW, {
          method: "cash",
          slipKey: null,
          paidOn: "2026-09-05",
        })
      ).status,
    ).toBe(403);
  });
});
