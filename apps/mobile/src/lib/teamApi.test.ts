import { describe, expect, it } from "vitest";
import type { FetchFn } from "./signIn";
import {
  StaffRefusal,
  createStaff,
  fetchActivity,
  fetchSalary,
  fetchTeam,
  paySalary,
  recordAdvance,
  slipPath,
} from "./teamApi";

function replying(reply: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url: String(url), init });
    return reply(String(url), init);
  };
  return { calls, fetchFn };
}

const signed = (init?: RequestInit) => JSON.stringify(init?.headers ?? {}).includes("tok");

describe("fetchTeam", () => {
  it("given the list > then it reads it signed in, with yes/no fields as true/false", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({
        staff: [
          {
            id: "u1",
            name: "บอย",
            nameTh: "บอย",
            role: "mechanic",
            status: "active",
            lastLoginAt: 5,
            hasPhoto: 1,
            dayRateSatang: 45000,
          },
        ],
      }),
    );
    const team = await fetchTeam(fetchFn, "http://api", "tok");
    expect(calls[0]!.url).toBe("http://api/staff");
    expect(signed(calls[0]!.init)).toBe(true);
    expect(team[0]).toMatchObject({ id: "u1", nameTh: "บอย", hasPhoto: true, lockedUntil: null });
    expect(team[0]!.nameEn).toBeNull();
  });

  it("given the server fails > then it throws, so the page offers ลองอีกครั้ง", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "down" }, { status: 500 }));
    await expect(fetchTeam(fetchFn, "http://api", "tok")).rejects.toThrow();
  });
});

describe("createStaff", () => {
  it("given the add form > then it posts it and returns the new id", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ id: "u9" }, { status: 201 }));
    const id = await createStaff(fetchFn, "http://api", "tok", { nameTh: "บอย", pin: "482913" });
    expect(calls[0]!.url).toBe("http://api/staff");
    expect(calls[0]!.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ nameTh: "บอย", pin: "482913" });
    expect(id).toBe("u9");
  });

  it("given a box the server refuses > then it says which box and why", async () => {
    const { fetchFn } = replying(() =>
      Response.json(
        { error: "email_taken", field: "email", message: "that email already has an account" },
        { status: 409 },
      ),
    );
    const out = createStaff(fetchFn, "http://api", "tok", { nameTh: "บอย" });
    await expect(out).rejects.toBeInstanceOf(StaffRefusal);
    await expect(out).rejects.toMatchObject({ code: "email_taken", field: "email" });
  });
});

describe("fetchSalary", () => {
  it("given a month > then it asks for it and keeps each row's advance and what is left", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({
        period: "2026-10",
        rows: [
          {
            userId: "u1",
            name: "เอก",
            amountSatang: 1372500,
            advanceSatang: 200000,
            dueSatang: 1172500,
            paidAt: null,
          },
        ],
      }),
    );
    const rows = await fetchSalary(fetchFn, "http://api", "tok", "2026-10");
    expect(calls[0]!.url).toBe("http://api/staff/salary?month=2026-10");
    expect(rows[0]).toMatchObject({ advanceSatang: 200000, dueSatang: 1172500, hasSlip: false });
  });

  it("given an older server without advances on the row > then nothing was advanced", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ rows: [{ userId: "u1", name: "บอย", amountSatang: 1350000 }] }),
    );
    const rows = await fetchSalary(fetchFn, "http://api", "tok", "2026-10");
    expect(rows[0]).toMatchObject({ advanceSatang: 0, dueSatang: 1350000, paidAt: null });
  });
});

describe("paySalary", () => {
  const slip = new Blob(["x"], { type: "image/jpeg" });

  it("given a transfer > then the slip goes as the body, the month and method in the address", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await paySalary(fetchFn, "http://api", "tok", "u1", {
      period: "2026-10",
      method: "transfer",
      photo: slip,
    });
    expect(calls[0]!.url).toBe("http://api/staff/u1/salary-paid?period=2026-10&method=transfer");
    expect(calls[0]!.init?.body).toBe(slip);
    expect(JSON.stringify(calls[0]!.init?.headers)).toContain("image/jpeg");
  });

  it("given cash with who paid and no photo > then it names the payer and sends no body", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await paySalary(fetchFn, "http://api", "tok", "u1", {
      period: "2026-10",
      method: "cash",
      photo: null,
      paidBy: "u-owner",
    });
    expect(calls[0]!.url).toBe(
      "http://api/staff/u1/salary-paid?period=2026-10&method=cash&paidBy=u-owner",
    );
    expect(calls[0]!.init?.body).toBeUndefined();
  });

  it("given the month was already paid > then it throws the refusal", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "that month has already been paid" }, { status: 409 }),
    );
    await expect(
      paySalary(fetchFn, "http://api", "tok", "u1", {
        period: "2026-10",
        method: "cash",
        photo: null,
      }),
    ).rejects.toThrow("already been paid");
  });
});

describe("recordAdvance", () => {
  it("given an advance > then it posts its day, amount, method, slip and payer", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }, { status: 201 }));
    await recordAdvance(fetchFn, "http://api", "tok", "u1", {
      period: "2026-10",
      givenOn: "2026-10-29",
      amountSatang: 100000,
      method: "cash",
      slipKey: null,
      note: null,
      paidBy: "u-owner",
    });
    expect(calls[0]!.url).toBe("http://api/staff/u1/advances");
    expect(JSON.parse(String(calls[0]!.init?.body))).toMatchObject({
      givenOn: "2026-10-29",
      amountSatang: 100000,
      paidBy: "u-owner",
    });
  });
});

describe("fetchActivity", () => {
  it("given a person and a month > then it asks for only those", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ activity: [] }));
    await fetchActivity(fetchFn, "http://api", "tok", { person: "u1", month: "2026-10" });
    expect(calls[0]!.url).toBe("http://api/staff/activity?person=u1&month=2026-10");
  });

  it("given everyone > then it leaves the person out", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ activity: [] }));
    await fetchActivity(fetchFn, "http://api", "tok", { person: null, month: "2026-10" });
    expect(calls[0]!.url).toBe("http://api/staff/activity?month=2026-10");
  });
});

describe("slipPath", () => {
  it("points at a wage slip by person and month, and an advance's by its id", () => {
    expect(slipPath({ kind: "salary", period: "2026-09" }, "u1")).toBe(
      "/staff/u1/salary-slip?period=2026-09",
    );
    expect(slipPath({ kind: "advance", id: "a 1" }, "u1")).toBe("/staff/advances/a%201/slip");
  });
});
