import { describe, it, expect } from "vitest";
import {
  readHandoff,
  stashHandoff,
  clearHandoff,
  stashSettlement,
  readSettlement,
  clearSettlement,
  type BillHandoff,
} from "./paymentHandoff";

/** Stand-in for sessionStorage, so the handoff is testable in node. */
function fakeStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    get size() {
      return map.size;
    },
  };
}

const bill: BillHandoff = {
  draftId: "d-1",
  saleNumber: "DAS202607-29001",
  quotationNumber: "QT202607-29001",
  plate: "1กท1111",
  vehicle: "Toyota Vigo 2012",
  note: "",
  discountSatang: 0,
  totalSatang: 450000,
  lines: [{ kind: "service", name: "ล้างแอร์", quantity: 1, unitPriceSatang: 450000 }],
};

describe("payment handoff", () => {
  it("carries the bill from the counter to the payment step", () => {
    const store = fakeStore();
    stashHandoff(bill, store);
    expect(readHandoff(store)).toEqual(bill);
  });

  it("survives a page reload — it is not held in memory", () => {
    const store = fakeStore();
    stashHandoff(bill, store);
    // A fresh read, as a newly loaded page would do.
    expect(readHandoff(store)?.lines).toHaveLength(1);
    expect(readHandoff(store)?.totalSatang).toBe(450000);
  });

  it("given nothing handed over > reads as nothing, not a crash", () => {
    expect(readHandoff(fakeStore())).toBeNull();
  });

  it("given corrupted storage > reads as nothing rather than throwing", () => {
    const store = fakeStore();
    store.setItem("pos:payment:v1", "{not json");
    expect(readHandoff(store)).toBeNull();
  });

  it("is cleared once the sale is taken, so a refresh can't charge twice", () => {
    const store = fakeStore();
    stashHandoff(bill, store);
    clearHandoff(store);
    expect(readHandoff(store)).toBeNull();
    expect(store.size).toBe(0);
  });
});

describe("settlement handed back to the counter", () => {
  it("carries how the money arrived", () => {
    const store = fakeStore();
    stashSettlement({ draftId: "d-1", paymentMethod: "cash", receivedBy: "สมชาย" }, store);
    expect(readSettlement(store)).toEqual({
      draftId: "d-1",
      paymentMethod: "cash",
      receivedBy: "สมชาย",
    });
  });

  it("given none > reads as nothing", () => {
    expect(readSettlement(fakeStore())).toBeNull();
  });

  it("is cleared once the counter has completed the sale, so a refresh can't repeat it", () => {
    const store = fakeStore();
    stashSettlement({ draftId: "d-1", paymentMethod: "promptpay" }, store);
    clearSettlement(store);
    expect(readSettlement(store)).toBeNull();
  });
});
