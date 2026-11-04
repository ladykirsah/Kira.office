import { describe, expect, it } from "vitest";
import {
  OwnRefusal,
  fetchOwnDaysOff,
  fetchOwnProfile,
  recordOwnDayOff,
  removeOwnKey,
  saveOwnCode,
} from "./profileApi";
import type { FetchFn } from "./signIn";

function replying(reply: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url: String(url), init });
    return reply(String(url), init);
  };
  return { calls, fetchFn };
}

const signed = (init?: RequestInit) => JSON.stringify(init?.headers ?? {}).includes("tok");
const sent = (init?: RequestInit) => JSON.parse(String(init?.body ?? "{}")) as unknown;

describe("fetchOwnProfile", () => {
  it("given your profile > then it reads /staff/me/profile signed in, yes/no as true/false", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({
        profile: {
          id: "u1",
          name: "Kirsah",
          nameTh: "เคิร์ส",
          fullNameTh: "กิรษา ใจงาม",
          emergencyRelation: "แม่",
          email: "k@shop.test",
          role: "super_admin",
          hasPin: 1,
          hasPassword: 1,
          hasRecoveryKey: 0,
          recoverySetAt: null,
          dayRateSatang: null,
          password: "Kira2569!",
        },
      }),
    );
    const p = await fetchOwnProfile(fetchFn, "http://api", "tok");
    expect(calls[0]!.url).toBe("http://api/staff/me/profile");
    expect(signed(calls[0]!.init)).toBe(true);
    expect(p).toMatchObject({
      id: "u1",
      nameTh: "เคิร์ส",
      fullNameTh: "กิรษา ใจงาม",
      emergencyRelation: "แม่",
      hasPin: true,
      hasRecoveryKey: false,
      dayRateSatang: null,
      password: "Kira2569!",
    });
    expect(p.bankName).toBeNull();
  });

  it("given the server fails > then it throws, so the page offers ลองอีกครั้ง", async () => {
    const { fetchFn } = replying(() => new Response("", { status: 500 }));
    await expect(fetchOwnProfile(fetchFn, "http://api", "tok")).rejects.toThrow();
  });
});

describe("saveOwnCode", () => {
  it("given each kind > then it posts to your own route with the server's field name", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await saveOwnCode(fetchFn, "http://api", "tok", "password", "Kira2569!");
    await saveOwnCode(fetchFn, "http://api", "tok", "pin", "730514");
    await saveOwnCode(fetchFn, "http://api", "tok", "key", "ดาวเหนือ");
    expect(calls.map((c) => c.url)).toEqual([
      "http://api/staff/me/password",
      "http://api/staff/me/pin",
      "http://api/staff/me/recovery-key",
    ]);
    expect(calls.map((c) => c.init?.method)).toEqual(["POST", "POST", "POST"]);
    expect(calls.map((c) => sent(c.init))).toEqual([
      { password: "Kira2569!" },
      { pin: "730514" },
      { key: "ดาวเหนือ" },
    ]);
  });

  it("given a refusal > then an OwnRefusal with the status and the server's sentence", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "Someone already uses that PIN. Choose another." }, { status: 409 }),
    );
    const failed = await saveOwnCode(fetchFn, "http://api", "tok", "pin", "730514").catch(
      (e: unknown) => e,
    );
    expect(failed).toBeInstanceOf(OwnRefusal);
    expect(failed).toMatchObject({
      status: 409,
      message: "Someone already uses that PIN. Choose another.",
    });
  });
});

describe("removeOwnKey", () => {
  it("given เอาออก > then DELETE /staff/me/recovery-key", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await removeOwnKey(fetchFn, "http://api", "tok");
    expect(calls[0]!.url).toBe("http://api/staff/me/recovery-key");
    expect(calls[0]!.init?.method).toBe("DELETE");
    expect(signed(calls[0]!.init)).toBe(true);
  });
});

describe("your own days off", () => {
  it("given a month > then it reads /staff/me/days-off for it", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({ days: [{ id: "d1", day: "2026-11-03", halves: 1, reason: "พาแม่ไปหาหมอ" }] }),
    );
    const days = await fetchOwnDaysOff(fetchFn, "http://api", "tok", "2026-11");
    expect(calls[0]!.url).toBe("http://api/staff/me/days-off?month=2026-11");
    expect(days).toEqual([{ id: "d1", day: "2026-11-03", halves: 1, reason: "พาแม่ไปหาหมอ" }]);
  });

  it("given บันทึก > then it posts the day to /staff/me/day-off", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }, { status: 201 }));
    await recordOwnDayOff(fetchFn, "http://api", "tok", {
      day: "2026-11-04",
      halves: 2,
      reason: "",
    });
    expect(calls[0]!.url).toBe("http://api/staff/me/day-off");
    expect(sent(calls[0]!.init)).toEqual({ day: "2026-11-04", halves: 2, reason: "" });
  });
});
