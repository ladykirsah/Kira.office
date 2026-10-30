import { describe, expect, it } from "vitest";
import { issueMechanicBill, savedEarlier, newAttempt, type BillDeps } from "./mechanicBill";
import type { SaleRecord, SyncResult } from "./scanSale";
import type { ScanCard, ScannedPart } from "./scanTabs";

const oil: ScannedPart = {
  variantId: "v3",
  productId: "p3",
  productRef: "ND-OIL-8",
  name: "น้ำมันคอมแอร์ DENSO ND-OIL 8",
  brandName: null,
  barcode: "ND-OIL-8",
  photoKeys: [],
  onHand: 6,
  held: 0,
  unitPriceSatang: 32000,
  b2bPriceSatang: 29000,
  unitCostSatang: 18000,
};
const cards: ScanCard[] = [{ part: oil, value: 2 }];
const account = { label: "ร้าน", promptpayId: "0812345678", accountName: null };
const AT = new Date(2026, 9, 26, 14, 32).getTime();
const SAVED: SyncResult = { applied: 1, duplicates: 0, conflicts: [], validationErrors: [] };

function fakeShop(over: Partial<BillDeps> = {}) {
  const sent: SaleRecord[] = [];
  const paid: {
    methodLabel: string;
    promptpayId: string;
    amountSatang: number;
    saleNumber: string;
  }[] = [];
  const order: string[] = [];
  const deps: BillDeps = {
    saleNumbers: async () => ["DAS202610-26004"],
    sendSale: async (sale) => {
      sent.push(sale);
      order.push("sale");
      return SAVED;
    },
    recordPayment: async (p) => {
      paid.push(p);
      order.push("payment");
    },
    now: () => AT,
    ...over,
  };
  return { deps, sent, paid, order };
}

const input = (pay: "cash" | "promptpay") => ({
  cards,
  pay,
  account,
  shopName: "Den Air Service",
  lastIssued: null,
});

describe("issueMechanicBill", () => {
  it("given cash > then the sale is saved at the mechanic price under the next bill number, and the bill comes back", async () => {
    const shop = fakeShop();

    const out = await issueMechanicBill(shop.deps, newAttempt("u-1"), input("cash"));

    expect(out.ok).toBe(true);
    expect(shop.paid).toEqual([]);
    expect(shop.sent).toEqual([
      {
        clientUuid: "u-1",
        saleNumber: "DAS202610-26005",
        paymentMethod: "cash",
        saleType: "parts",
        lines: [
          {
            productVariantId: "v3",
            lineType: "part",
            description: "น้ำมันคอมแอร์ DENSO ND-OIL 8",
            barcodeValue: "ND-OIL-8",
            quantity: 2,
            unitPriceSatang: 29000,
            unitCostSatang: 18000,
          },
        ],
      },
    ]);
    expect(out.ok && out.bill).toEqual({
      shopName: "Den Air Service",
      saleNumber: "DAS202610-26005",
      at: AT,
      lines: [
        { name: "น้ำมันคอมแอร์ DENSO ND-OIL 8", qty: 2, unitSatang: 29000, totalSatang: 58000 },
      ],
      totalSatang: 58000,
      paidBy: "cash",
    });
  });

  it("given PromptPay > then the sale is saved first, then the payment goes on the payment list", async () => {
    const shop = fakeShop();

    const out = await issueMechanicBill(shop.deps, newAttempt("u-1"), input("promptpay"));

    expect(out.ok).toBe(true);
    expect(shop.order).toEqual(["sale", "payment"]);
    expect(shop.paid).toEqual([
      {
        methodLabel: "ร้าน",
        promptpayId: "0812345678",
        amountSatang: 58000,
        saleNumber: "DAS202610-26005",
      },
    ]);
    expect(shop.sent[0]?.paymentMethod).toBe("promptpay");
  });

  it("given PromptPay and too little stock > then nothing goes on the payment list either", async () => {
    const shop = fakeShop({
      sendSale: async () => ({
        applied: 0,
        duplicates: 0,
        conflicts: [{ productVariantId: "v3", requested: 2, available: 1 }],
        validationErrors: [],
      }),
    });

    const out = await issueMechanicBill(shop.deps, newAttempt("u-1"), input("promptpay"));

    expect(out.ok).toBe(false);
    expect(shop.paid).toEqual([]);
  });

  it("given this device issued a later number than the server knows > then it follows its own", async () => {
    const shop = fakeShop();

    await issueMechanicBill(shop.deps, newAttempt("u-1"), {
      ...input("cash"),
      lastIssued: "DAS202610-26009",
    });

    expect(shop.sent[0]?.saleNumber).toBe("DAS202610-26010");
  });

  it("given too little stock > then nothing is shown as paid and it says why", async () => {
    const shop = fakeShop({
      sendSale: async () => ({
        applied: 0,
        duplicates: 0,
        conflicts: [{ productVariantId: "v3", requested: 2, available: 1 }],
        validationErrors: [],
      }),
    });

    const out = await issueMechanicBill(shop.deps, newAttempt("u-1"), input("cash"));

    expect(out.ok).toBe(false);
    expect(!out.ok && out.why.th).toBe("สต็อกไม่พอ: มี 1 ขอ 2 แก้จำนวนแล้วลองอีกครั้ง");
  });

  it("given a retry after a dropped connection > then the same sale and number are sent again, and the PromptPay payment is not recorded twice", async () => {
    let calls = 0;
    const shop = fakeShop({
      sendSale: async () => {
        calls++;
        if (calls === 1) throw new TypeError("Failed to fetch");
        return { ...SAVED, applied: 0, duplicates: 1 };
      },
    });

    const first = await issueMechanicBill(shop.deps, newAttempt("u-1"), input("promptpay"));
    expect(first.ok).toBe(false);
    const second = await issueMechanicBill(shop.deps, first.attempt, input("promptpay"));

    expect(second.ok).toBe(true);
    expect(shop.paid).toHaveLength(1);
    expect(second.ok && second.bill.saleNumber).toBe("DAS202610-26005");
  });

  it("given the system failed outright > then the retry takes a fresh bill number, in case another device took this one", async () => {
    let numbers = ["DAS202610-26004"];
    let calls = 0;
    const shop = fakeShop({
      saleNumbers: async () => numbers,
      sendSale: async () => {
        calls++;
        if (calls === 1) {
          numbers = ["DAS202610-26004", "DAS202610-26005"]; // the other device's bill
          throw new Error("Bill was not saved (HTTP 500)");
        }
        return { ...SAVED, applied: 1 };
      },
    });

    const first = await issueMechanicBill(shop.deps, newAttempt("u-1"), input("cash"));
    const second = await issueMechanicBill(shop.deps, first.attempt, input("cash"));

    expect(second.ok && second.bill.saleNumber).toBe("DAS202610-26006");
  });

  it("given the sale saved but the payment list refused it > then the bill still shows, with a warning to check the payment list", async () => {
    const shop = fakeShop({
      recordPayment: async () => {
        throw new Error("Payment was not recorded (HTTP 400)");
      },
    });

    const out = await issueMechanicBill(shop.deps, newAttempt("u-1"), input("promptpay"));

    expect(out.ok).toBe(true);
    expect(shop.sent).toHaveLength(1);
    expect(out.ok && out.warning?.th).toBe(
      "ออกบิลแล้ว แต่บันทึกรายการรับเงินพร้อมเพย์ไม่สำเร็จ ตรวจที่หน้าการชำระเงิน",
    );
  });

  it("given cash, or a payment recorded fine > then there is no warning", async () => {
    const shop = fakeShop();

    const cash = await issueMechanicBill(shop.deps, newAttempt("u-1"), input("cash"));
    const qr = await issueMechanicBill(shop.deps, newAttempt("u-2"), input("promptpay"));

    expect(cash.ok && cash.warning).toBeNull();
    expect(qr.ok && qr.warning).toBeNull();
  });
});

describe("savedEarlier", () => {
  it("given an earlier try lost its answer and the shop lists its bill number > then that sale did save", () => {
    const unsure = { clientUuid: "u-1", saleNumber: "DAS202610-26005", at: AT };
    expect(savedEarlier(unsure, ["DAS202610-26004", "DAS202610-26005"])).toBe(true);
    expect(savedEarlier(unsure, ["DAS202610-26004"])).toBe(false);
  });

  it("given no try is waiting on an answer > then nothing could have saved", () => {
    expect(savedEarlier(newAttempt("u-1"), ["DAS202610-26005"])).toBe(false);
  });
});
