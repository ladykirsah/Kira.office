import { describe, it, expect } from "vitest";
import {
  checkJobMove,
  customerUpdateFor,
  jobLineProblem,
  nextJobNumber,
  waitUntil,
  workStatusFor,
} from "./repairJob";

// งานซ่อม (plan 10.1) — the owner's job flow, 17 Nov 2026.

const taken = { state: "taken" as const };
const waiting = { state: "waiting" as const };
const estimate = { state: "estimate" as const };
const removed = { state: "removed" as const };

describe("checkJobMove > forward one step at a time", () => {
  it("given each step > then the next step is allowed", () => {
    expect(checkJobMove("in", "check", [])).toEqual({ ok: true, kind: "forward" });
    expect(checkJobMove("check", "estimate", [])).toEqual({ ok: true, kind: "forward" });
    expect(checkJobMove("estimate", "agreed", [estimate])).toEqual({ ok: true, kind: "forward" });
  });

  it("given a jump over a step > then refused", () => {
    expect(checkJobMove("in", "estimate", [])).toEqual({ ok: false, error: "skip" });
    expect(checkJobMove("check", "working", [])).toEqual({ ok: false, error: "skip" });
  });

  it("given the customer agreed > then work starts, whether asked as working or รออะไหล่", () => {
    expect(checkJobMove("agreed", "working", [estimate])).toEqual({
      ok: true,
      kind: "start_work",
    });
    expect(checkJobMove("agreed", "waiting_parts", [estimate])).toEqual({
      ok: true,
      kind: "start_work",
    });
  });

  it("given รออะไหล่ > then moving to working ends the wait", () => {
    expect(checkJobMove("waiting_parts", "working", [taken, waiting])).toEqual({
      ok: true,
      kind: "end_wait",
    });
  });

  it("given working > then รออะไหล่ is never picked by hand (a missing part puts it there)", () => {
    expect(checkJobMove("working", "waiting_parts", [taken])).toEqual({
      ok: false,
      error: "not_waiting",
    });
  });
});

describe("checkJobMove > พร้อมรับรถ issues the bill", () => {
  it("given every line on the bill > then ready", () => {
    expect(checkJobMove("working", "ready", [taken, removed])).toEqual({ ok: true, kind: "ready" });
  });

  it("given a part still waiting > then refused", () => {
    expect(checkJobMove("waiting_parts", "ready", [taken, waiting])).toEqual({
      ok: false,
      error: "lines_not_taken",
    });
  });

  it("given nothing on the bill > then refused", () => {
    expect(checkJobMove("working", "ready", [removed])).toEqual({
      ok: false,
      error: "nothing_on_bill",
    });
  });
});

describe("checkJobMove > backward, closed and the special steps", () => {
  it("given any earlier step > then allowed (owner: backward = yes)", () => {
    expect(checkJobMove("ready", "working", [taken])).toEqual({ ok: true, kind: "back" });
    expect(checkJobMove("working", "estimate", [taken])).toEqual({ ok: true, kind: "back" });
    expect(checkJobMove("check", "in", [])).toEqual({ ok: true, kind: "back" });
  });

  it("given back to รออะไหล่ by hand > then refused", () => {
    expect(checkJobMove("ready", "waiting_parts", [taken])).toEqual({
      ok: false,
      error: "not_waiting",
    });
  });

  it("given a paid or cancelled job > then nothing moves", () => {
    expect(checkJobMove("paid", "working", [])).toEqual({ ok: false, error: "closed" });
    expect(checkJobMove("cancelled", "in", [])).toEqual({ ok: false, error: "closed" });
  });

  it("given paid or cancelled as the target > then their own actions are used", () => {
    expect(checkJobMove("ready", "paid", [taken])).toEqual({ ok: false, error: "use_pay" });
    expect(checkJobMove("in", "cancelled", [])).toEqual({ ok: false, error: "use_cancel" });
  });

  it("given the same step > then refused", () => {
    expect(checkJobMove("check", "check", [])).toEqual({ ok: false, error: "same" });
  });
});

describe("workStatusFor > the status the job shows while being worked on", () => {
  it("given A in stock, B waiting, C in stock > then รออะไหล่ (owner's mixed-parts case)", () => {
    expect(workStatusFor([taken, waiting, taken])).toBe("waiting_parts");
  });

  it("given nothing waiting > then working", () => {
    expect(workStatusFor([taken, removed])).toBe("working");
    expect(workStatusFor([])).toBe("working");
  });
});

describe("waitUntil > the time the customer is told", () => {
  it("given several waiting parts > then the last one's time", () => {
    expect(
      waitUntil([
        { state: "waiting", expectedAt: 1_000 },
        { state: "waiting", expectedAt: 3_000 },
        { state: "taken", expectedAt: 9_000 },
      ]),
    ).toBe(3_000);
  });

  it("given a waiting part with no time yet > then the latest known time", () => {
    expect(
      waitUntil([
        { state: "waiting", expectedAt: null },
        { state: "waiting", expectedAt: 2_000 },
      ]),
    ).toBe(2_000);
  });

  it("given nothing waiting > then none", () => {
    expect(waitUntil([{ state: "taken", expectedAt: 5_000 }])).toBeNull();
  });
});

describe("customerUpdateFor > the LINE OA update each step sends", () => {
  it("given the owner's five steps > then each has its update", () => {
    for (const s of ["in", "check", "waiting_parts", "working", "ready"] as const) {
      expect(customerUpdateFor(s)).toBe(s);
    }
  });

  it("given the shop-only steps > then none", () => {
    for (const s of ["estimate", "agreed", "paid", "cancelled"] as const) {
      expect(customerUpdateFor(s)).toBeNull();
    }
  });
});

describe("jobLineProblem > a line on the job", () => {
  const part = {
    lineType: "part",
    productVariantId: "v-1",
    description: "คอมเพรสเซอร์ DENSO 10S11C",
    quantity: 1,
    unitPriceSatang: 450_000,
    discountSatang: 0,
  };

  it("given a part, a service, and a new part typed by name > then all fine", () => {
    expect(jobLineProblem(part)).toBeNull();
    expect(
      jobLineProblem({
        ...part,
        lineType: "service",
        productVariantId: null,
        description: "ล้างแอร์",
      }),
    ).toBeNull();
    expect(jobLineProblem({ ...part, productVariantId: null })).toBeNull();
  });

  it("given bad amounts > then each is named", () => {
    expect(jobLineProblem({ ...part, quantity: 0 })).toBe(
      "quantity must be a whole number, 1 or more",
    );
    expect(jobLineProblem({ ...part, quantity: 1.5 })).toBe(
      "quantity must be a whole number, 1 or more",
    );
    expect(jobLineProblem({ ...part, unitPriceSatang: -1 })).toBe(
      "price must be a whole number of satang, 0 or more",
    );
    expect(jobLineProblem({ ...part, discountSatang: 450_001 })).toBe(
      "discount must be between 0 and the line's price",
    );
  });

  it("given no name, an unknown kind, or a service with a product > then refused", () => {
    expect(jobLineProblem({ ...part, description: "  " })).toBe("a line needs a name");
    expect(jobLineProblem({ ...part, lineType: "other" })).toBe(
      "line type must be part or service",
    );
    expect(jobLineProblem({ ...part, lineType: "service" })).toBe("a service line has no product");
  });
});

describe("nextJobNumber > made by the server, Thai date", () => {
  // 17 Nov 2026 23:30 in Bangkok = 16:30 UTC — still the 17th in Thailand.
  const lateEvening = Date.UTC(2026, 10, 17, 16, 30);

  it("given no job yet today > then 001", () => {
    expect(nextJobNumber([], lateEvening)).toBe("JB202611-17001");
  });

  it("given today's jobs > then one after the highest; other days don't count", () => {
    expect(
      nextJobNumber(
        ["JB202611-17002", "JB202611-17009", "JB202611-16044", "DAS202611-17050"],
        lateEvening,
      ),
    ).toBe("JB202611-17010");
  });

  it("given just after midnight in Bangkok > then the new day", () => {
    const afterMidnight = Date.UTC(2026, 10, 17, 17, 5); // 00:05 on the 18th, Bangkok
    expect(nextJobNumber(["JB202611-17009"], afterMidnight)).toBe("JB202611-18001");
  });
});
