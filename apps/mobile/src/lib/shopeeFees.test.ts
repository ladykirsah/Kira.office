import { describe, expect, it } from "vitest";
import {
  draftOf,
  FEE_ROWS,
  fetchShopeeFees,
  readDraft,
  parsePercent,
  percentInput,
  percentText,
  saveShopeeFees,
  totalBp,
} from "./shopeeFees";
import type { FetchFn } from "./signIn";

// ค่าคอม Shopee (owner, 5 Nov 2026: "i want A, but on the main page is total %, and the pop up shown all
// amount we have been charged"). Fees are hundredths of a percent: 12% is 1200, 3.21% is 321.

function replying(reply: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url: String(url), init });
    return reply(String(url), init);
  };
  return { calls, fetchFn };
}

const FEES = { commissionBp: 1200, transactionBp: 300, serviceBp: 200 };

describe("the sheet's rows", () => {
  it("lists every fee Shopee charges, as drawn", () => {
    expect(FEE_ROWS.map((r) => r.label.th)).toEqual([
      "ค่าคอมมิชชั่น",
      "ค่าธรรมเนียมธุรกรรม",
      "ค่าบริการโปรแกรม",
    ]);
  });
});

describe("totalBp / percentText (ข้อมูลร้าน's row shows the total)", () => {
  it("given 12% + 3% + 2% > then 17%", () => {
    expect(totalBp(FEES)).toBe(1700);
    expect(percentText(totalBp(FEES))).toBe("17%");
  });

  it("given a fee with hundredths > then it keeps them; nothing set > 0%", () => {
    expect(percentText(321)).toBe("3.21%");
    expect(percentText(350)).toBe("3.5%");
    expect(percentText(0)).toBe("0%");
  });
});

describe("percentInput / parsePercent (the % boxes)", () => {
  it("given a saved fee > then the box shows it; 0 shows an empty box", () => {
    expect(percentInput(1200)).toBe("12");
    expect(percentInput(321)).toBe("3.21");
    expect(percentInput(0)).toBe("");
  });

  it("given typed % > then hundredths of a percent; an empty box is 0", () => {
    expect(parsePercent("12")).toBe(1200);
    expect(parsePercent(" 3.21 ")).toBe(321);
    expect(parsePercent("")).toBe(0);
  });

  it("given words, three decimals, or more than 100 > then null (not an amount)", () => {
    expect(parsePercent("abc")).toBeNull();
    expect(parsePercent("3.215")).toBeNull();
    expect(parsePercent("101")).toBeNull();
    expect(parsePercent("-2")).toBeNull();
  });
});

describe("fetchShopeeFees / saveShopeeFees", () => {
  it("given saved fees > then it reads them, signed in", async () => {
    const { calls, fetchFn } = replying(() => Response.json(FEES));
    expect(await fetchShopeeFees(fetchFn, "http://api", "tok")).toEqual(FEES);
    expect(calls[0]!.url).toBe("http://api/shopee-fees");
    expect(JSON.stringify(calls[0]!.init?.headers)).toContain("tok");
  });

  it("given the server fails > then it throws, so the page offers ลองอีกครั้ง", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "down" }, { status: 500 }));
    await expect(fetchShopeeFees(fetchFn, "http://api", "tok")).rejects.toThrow();
  });

  it("given new fees > then it puts all three and returns what the server kept", async () => {
    const { calls, fetchFn } = replying(() => Response.json(FEES));
    expect(await saveShopeeFees(fetchFn, "http://api", "tok", FEES)).toEqual(FEES);
    expect(calls[0]!.init?.method).toBe("PUT");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual(FEES);
  });

  it("given the owner-only refusal > then it throws with the server's reason", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "forbidden", reason: "super_admin_only" }, { status: 403 }),
    );
    await expect(saveShopeeFees(fetchFn, "http://api", "tok", FEES)).rejects.toThrow();
  });
});

describe("draftOf / readDraft (the sheet's boxes)", () => {
  it("given saved fees > then the boxes show them, and read back unchanged", () => {
    const draft = draftOf(FEES);
    expect(draft).toEqual({ commissionBp: "12", transactionBp: "3", serviceBp: "2" });
    expect(readDraft(draft)).toEqual({ fees: FEES, problems: {}, totalBp: 1700 });
  });

  it("given a box that is not a number > then that box says so, and nothing is saved", () => {
    const out = readDraft({ commissionBp: "12", transactionBp: "สาม", serviceBp: "" });
    expect(out.fees).toBeNull();
    expect(out.problems.transactionBp?.th).toBe("ใส่เป็นตัวเลข 0–100");
    expect(out.problems.commissionBp).toBeUndefined();
    expect(out.totalBp).toBeNull();
  });

  it("given fees that add up to more than 100% > then the total says so", () => {
    const out = readDraft({ commissionBp: "60", transactionBp: "41", serviceBp: "" });
    expect(out.fees).toBeNull();
    expect(out.problems.total?.th).toBe("รวมเกิน 100%");
  });

  it("given fees over 100% > then รวม still shows their real total", () => {
    expect(readDraft({ commissionBp: "60", transactionBp: "50", serviceBp: "2" }).totalBp).toBe(
      11200,
    );
  });
});
