import { describe, expect, it } from "vitest";
import type { BillSale } from "./posBill";
import {
  isNetworkError,
  queueRefusal,
  parseQueue,
  queueAdd,
  queueAfterSend,
  billPayment,
  queueSummary,
  type QueuedBill,
} from "./posQueue";

const sale = (uuid: string): BillSale => ({
  clientUuid: uuid,
  saleNumber: `DAS202610-30${uuid.padStart(3, "0")}`,
  paymentMethod: "cash",
  saleType: "repair",
  licensePlate: "1กก 1234",
  mileageKm: 152_300,
  buyerName: null,
  lines: [],
});

const queued = (uuid: string, over: Partial<QueuedBill> = {}): QueuedBill => ({
  sale: sale(uuid),
  issuedAt: 1,
  totalSatang: 406_000,
  label: "1กก 1234",
  status: "waiting",
  reason: null,
  ...over,
});

describe("posQueue", () => {
  it("queueAdd > given the same bill twice > then it is kept once, never counted twice", () => {
    const q = queueAdd(queueAdd([], queued("1")), queued("1", { issuedAt: 2 }));
    expect(q).toHaveLength(1);
    expect(q[0]?.issuedAt).toBe(2);
  });

  it("queueAfterSend > given the server saved it > then it leaves the queue", () => {
    expect(queueAfterSend([queued("1"), queued("2")], "1", { kind: "saved" })).toEqual([
      queued("2"),
    ]);
  });

  it("queueAfterSend > given the server refused it > then it stays, marked with the reason", () => {
    const q = queueAfterSend([queued("1")], "1", { kind: "refused", reason: "ในระบบเหลือ 0" });
    expect(q[0]).toMatchObject({ status: "refused", reason: "ในระบบเหลือ 0" });
  });

  it("queueAfterSend > given still no internet > then it stays waiting", () => {
    expect(queueAfterSend([queued("1")], "1", { kind: "offline" })).toEqual([queued("1")]);
  });

  /**
   * Bug hunt 15 Nov 2026: a new copy of an unchanged queue looked like a change, so the page saved it
   * and its "queue changed → send again" timer fired at once — nonstop, instead of once a minute.
   */
  it("queueAfterSend > given nothing changed (offline, or refused again for the same reason) > then the very same queue", () => {
    const waiting = [queued("1")];
    expect(queueAfterSend(waiting, "1", { kind: "offline" })).toBe(waiting);
    const refused = [queued("1", { status: "refused", reason: "ในระบบเหลือ 0" })];
    expect(queueAfterSend(refused, "1", { kind: "refused", reason: "ในระบบเหลือ 0" })).toBe(
      refused,
    );
  });

  /**
   * Bug hunt 15 Nov 2026: a PromptPay bill issued with no internet never reached การชำระเงิน — the
   * waiting bill kept the car and the draft, but not the money. The same record now goes with it.
   */
  it("billPayment > given a PromptPay bill > then the money record การชำระเงิน needs", () => {
    expect(
      billPayment("promptpay", { label: "ร้าน", promptpayId: "0812344421" }, 125_000, "DAS-0042"),
    ).toEqual({
      methodLabel: "ร้าน",
      promptpayId: "0812344421",
      amountSatang: 125_000,
      saleNumber: "DAS-0042",
    });
  });

  it("billPayment > given cash, or no account to pay into > then none", () => {
    expect(
      billPayment("cash", { label: "ร้าน", promptpayId: "0812344421" }, 1, "DAS-1"),
    ).toBeNull();
    expect(billPayment("promptpay", null, 1, "DAS-1")).toBeNull();
  });

  it("parseQueue > given saved text > then reads it back, and broken text reads as empty", () => {
    expect(parseQueue(JSON.stringify([queued("1")]))).toEqual([queued("1")]);
    expect(parseQueue("{not json")).toEqual([]);
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue(JSON.stringify([{ nope: true }, queued("2")]))).toEqual([queued("2")]);
  });

  it("queueSummary > given waiting and refused bills > then counts both", () => {
    expect(queueSummary([queued("1"), queued("2", { status: "refused", reason: "x" })])).toEqual({
      count: 2,
      refused: 1,
    });
  });

  it("isNetworkError > given a failed fetch > then it is the network, not a refusal", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("Not enough stock"))).toBe(false);
  });
});

describe("posQueue refusal", () => {
  it("queueRefusal > given a stock clash > then names the part, what the system has and what was sold", () => {
    const s = {
      ...sale("1"),
      lines: [
        {
          productVariantId: "v9",
          lineType: "part" as const,
          description: "วาล์วแอร์ DENSO Vigo",
          quantity: 2,
          unitPriceSatang: 48_000,
          unitCostSatang: 0,
        },
      ],
    };
    const result = {
      applied: 0,
      duplicates: 0,
      conflicts: [{ productVariantId: "v9", requested: 2, available: 0 }],
      validationErrors: [],
    };
    expect(queueRefusal(s, result)).toBe("วาล์วแอร์ DENSO Vigo · ในระบบเหลือ 0 ขายไป 2");
  });

  it("queueRefusal > given another refusal > then the server's own reason", () => {
    const result = {
      applied: 0,
      duplicates: 0,
      conflicts: [],
      validationErrors: [{ clientUuid: "1", reason: "bad line" }],
    };
    expect(queueRefusal(sale("1"), result)).toBe("ระบบไม่รับบิลนี้: bad line");
  });
});
