import { describe, expect, it } from "vitest";
import { clearPayments, fetchPayments, takePayment, verifySlip } from "./paymentApi";
import type { FetchFn } from "./signIn";

function recording(reply: () => Promise<Response>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    return reply();
  };
  return { calls, fetchFn };
}

describe("paymentApi", () => {
  it("fetchPayments > reads the list and whether slips are being checked", async () => {
    const { calls, fetchFn } = recording(async () =>
      Response.json({ payments: [{ id: "p1" }], slipVerifyEnabled: false }),
    );
    expect(await fetchPayments(fetchFn, "http://api", "tok")).toEqual({
      payments: [{ id: "p1" }],
      slipCheckOn: false,
    });
    expect(calls[0]?.url).toBe("http://api/payments");
  });

  it("takePayment > records the PromptPay money and answers with the saved row", async () => {
    const saved = { id: "p9", createdAt: 1 };
    const { calls, fetchFn } = recording(async () =>
      Response.json({ payment: saved }, { status: 201 }),
    );
    const take = { methodLabel: "ร้าน", promptpayId: "0812344421", amountSatang: 125_000 };
    expect(await takePayment(fetchFn, "http://api", "tok", take)).toEqual(saved);
    expect(calls[0]?.url).toBe("http://api/payments");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(take);
  });

  it("clearPayments > clears only the rows the page shows, and answers how many", async () => {
    const { calls, fetchFn } = recording(async () => Response.json({ cleared: 2 }));
    expect(await clearPayments(fetchFn, "http://api", "tok", ["p1", "p2"])).toBe(2);
    expect(calls[0]?.url).toBe("http://api/payments/clear");
    expect(calls[0]?.init?.method).toBe("POST");
    // Bug hunt 15 Nov 2026: a payment taken after the page opened must not be cleared unseen.
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ ids: ["p1", "p2"] });
  });

  it("clearPayments > given someone who is not the owner > then it says so", async () => {
    const { fetchFn } = recording(async () =>
      Response.json({ error: "forbidden", reason: "super_admin_only" }, { status: 403 }),
    );
    await expect(clearPayments(fetchFn, "http://api", "tok", ["p1"])).rejects.toThrow("forbidden");
  });

  it("verifySlip > sends the slip's QR for that payment", async () => {
    const { calls, fetchFn } = recording(async () => Response.json({ ok: true, ref: "0129-8841" }));
    expect(await verifySlip(fetchFn, "http://api", "tok", "p 1", "0046000600")).toBe("0129-8841");
    expect(calls[0]?.url).toBe("http://api/payments/p%201/verify-slip");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ qrData: "0046000600" });
  });

  it("verifySlip > given a slip used before > then the server's reason comes back", async () => {
    const { fetchFn } = recording(async () =>
      Response.json({ error: "this slip was already used" }, { status: 409 }),
    );
    await expect(verifySlip(fetchFn, "http://api", "tok", "p1", "x")).rejects.toThrow(
      "this slip was already used",
    );
  });
});
