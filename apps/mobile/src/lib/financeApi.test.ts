import { describe, expect, it } from "vitest";
import {
  deleteExpense,
  expenseSlipPath,
  fetchBills,
  putExpenseSlip,
  refundBill,
  saveExpense,
} from "./financeApi";
import type { FetchFn } from "./signIn";

function replying(reply: () => Promise<Response>) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return reply();
  };
  return { calls, fetchFn };
}

const ok = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 });

describe("financeApi", () => {
  it("putExpenseSlip > given a picture > then PUT it as the body with its type, behind the session", async () => {
    const seen: { url: string; method: string; type: string | null; body: unknown }[] = [];
    const fetchFn: FetchFn = async (url, init) => {
      const headers = new Headers(init?.headers);
      seen.push({
        url,
        method: init?.method ?? "GET",
        type: headers.get("content-type"),
        body: init?.body,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const photo = new Blob([new Uint8Array([1, 2])], { type: "image/png" });
    await putExpenseSlip(fetchFn, "https://api", "t", "e 1", photo);
    expect(seen[0]).toMatchObject({
      url: "https://api/finance/expenses/e%201/slip",
      method: "PUT",
      type: "image/png",
      body: photo,
    });
    expect(expenseSlipPath("e 1")).toBe("/finance/expenses/e%201/slip");
  });

  it("putExpenseSlip > given the server refuses > then it throws so the page can say so", async () => {
    const fetchFn: FetchFn = async () =>
      new Response(JSON.stringify({ error: "x" }), { status: 400 });
    await expect(
      putExpenseSlip(fetchFn, "https://api", "t", "e1", new Blob([], { type: "image/jpeg" })),
    ).rejects.toThrow();
  });

  it("fetchBills > given a period > then it asks for that period's bills", async () => {
    const { calls, fetchFn } = replying(ok({ sales: [{ id: "b1" }] }));
    expect(await fetchBills(fetchFn, "https://api", "t", { from: 10, to: 20 })).toEqual([
      { id: "b1" },
    ]);
    expect(calls[0]!.url).toBe("https://api/sales?from=10&to=20");
  });

  it("saveExpense > given a new one > then POST; given an id > then PUT to that expense", async () => {
    const body = {
      channel: "onsite" as const,
      conversion: "ค่าไฟร้าน",
      amountSatang: 385000,
      occurredAt: 1,
    };
    const { calls, fetchFn } = replying(ok({ ok: true, expense: { id: "e1" } }));
    await saveExpense(fetchFn, "https://api", "t", null, body);
    await saveExpense(fetchFn, "https://api", "t", "e1", body);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://api/finance/expenses",
      "PUT https://api/finance/expenses/e1",
    ]);
    expect(calls[0]!.body).toEqual(body);
  });

  it("saveExpense > given the server refuses > then it throws so the page can say so", async () => {
    const { fetchFn } = replying(
      async () => new Response(JSON.stringify({ ok: false, error: "x" }), { status: 400 }),
    );
    await expect(
      saveExpense(fetchFn, "https://api", "t", null, {
        channel: "onsite",
        conversion: "",
        amountSatang: 0,
        occurredAt: 1,
      }),
    ).rejects.toThrow();
  });

  it("deleteExpense > then DELETE that expense", async () => {
    const { calls, fetchFn } = replying(ok({ ok: true }));
    await deleteExpense(fetchFn, "https://api", "t", "e 1");
    expect(`${calls[0]!.method} ${calls[0]!.url}`).toBe(
      "DELETE https://api/finance/expenses/e%201",
    );
  });

  it("refundBill > given the bill was already refunded > then it says so instead of claiming success", async () => {
    const { calls, fetchFn } = replying(
      ok({ saleId: "b1", applied: false, restockedLines: 0, reason: "already refunded" }),
    );
    await expect(refundBill(fetchFn, "https://api", "t", "b1")).rejects.toThrow("already refunded");
    expect(`${calls[0]!.method} ${calls[0]!.url}`).toBe("POST https://api/sales/b1/refund");
  });
});
