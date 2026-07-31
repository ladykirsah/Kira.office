import { describe, it, expect } from "vitest";
import { orderStages } from "./orderStages";

/** Labels/keys/states are the contract the stepper renders, so assert on them directly. */
const labels = (s: ReturnType<typeof orderStages>) => s.map((x) => x.label);
const current = (s: ReturnType<typeof orderStages>) => s.find((x) => x.state === "current");

describe("orderStages", () => {
  it("every order > opens with the customer's สั่งซื้อสินค้า, never a system 'new order'", () => {
    for (const [os, ps] of [
      ["new", "pending"],
      ["confirmed", "paid"],
      ["delivered", "paid"],
      ["cancelled", "pending"],
    ] as const) {
      const s = orderStages(os, ps);
      expect(s[0]).toMatchObject({ key: "placed", label: "สั่งซื้อสินค้า", state: "done" });
      expect(labels(s)).not.toContain("คำสั่งซื้อใหม่");
    }
  });

  it("any order > has exactly one current step", () => {
    for (const [os, ps] of [
      ["new", "pending"],
      ["new", "cod"],
      ["confirmed", "paid"],
      ["shipped", "paid"],
      ["delivered", "paid"],
      ["cancelled", "pending"],
      ["delivery_failed", "paid"],
      ["claim_pending", "paid"],
      ["claimed", "refunded"],
      ["claim_rejected", "paid"],
    ] as const) {
      expect(orderStages(os, ps).filter((x) => x.state === "current")).toHaveLength(1);
    }
  });

  it("prepaid, to ship > payment done, เตรียมจัดส่ง is current, shipping ahead is upcoming", () => {
    const s = orderStages("confirmed", "paid");
    expect(labels(s)).toEqual([
      "สั่งซื้อสินค้า",
      "ชำระเงินแล้ว",
      "เตรียมจัดส่ง",
      "กำลังจัดส่ง",
      "จัดส่งสำเร็จ",
    ]);
    expect(current(s)?.key).toBe("to_ship");
    expect(s.find((x) => x.key === "in_transit")?.state).toBe("upcoming");
  });

  it("prepaid, delivered > every step done and จัดส่งสำเร็จ is current", () => {
    const s = orderStages("delivered", "paid");
    expect(current(s)?.key).toBe("complete");
    expect(s.filter((x) => x.state === "upcoming")).toHaveLength(0);
  });

  it("COD approved by staff > payment step names the approver", () => {
    const s = orderStages("confirmed", "cod_confirmed");
    const pay = s.find((x) => x.key === "payment");
    expect(pay).toMatchObject({
      label: "อนุมัติเก็บเงินปลายทาง",
      state: "done",
      note: "อนุมัติโดย L",
    });
  });

  it("COD approved automatically (best/good tier) > note reads อนุมัติอัตโนมัติ", () => {
    const s = orderStages("confirmed", "cod_confirmed", [], { codAutoApproved: true });
    const pay = s.find((x) => x.key === "payment");
    expect(pay).toMatchObject({
      label: "อนุมัติเก็บเงินปลายทาง",
      state: "done",
      note: "อนุมัติอัตโนมัติ",
    });
  });

  it("COD pending > payment step is current with no approver note yet", () => {
    const s = orderStages("new", "cod");
    const pay = s.find((x) => x.key === "payment");
    expect(pay).toMatchObject({ label: "รออนุมัติเก็บเงินปลายทาง", state: "current" });
    expect(pay?.note).toBeUndefined();
  });

  it("unpaid > payment is current and the rest are upcoming", () => {
    const s = orderStages("new", "pending");
    expect(current(s)?.label).toBe("รอชำระเงิน");
    expect(labels(s).slice(2)).toEqual(["เตรียมจัดส่ง", "กำลังจัดส่ง", "จัดส่งสำเร็จ"]);
    expect(s.slice(2).every((x) => x.state === "upcoming")).toBe(true);
  });

  it("cancelled > stops at ยกเลิกคำสั่งซื้อ with no upcoming steps", () => {
    const s = orderStages("cancelled", "pending");
    expect(labels(s)).toEqual(["สั่งซื้อสินค้า", "ยกเลิกคำสั่งซื้อ"]);
    expect(current(s)?.key).toBe("cancelled");
  });

  it("delivery failed > shows ตีกลับ as current after a completed shipment", () => {
    const s = orderStages("delivery_failed", "paid");
    expect(current(s)?.label).toBe("ตีกลับ (ส่งไม่สำเร็จ)");
    expect(s.find((x) => x.key === "in_transit")?.state).toBe("done");
  });

  it("claim pending > delivered, claim opened, waiting on the mechanic", () => {
    const s = orderStages("claim_pending", "paid");
    expect(s.find((x) => x.key === "complete")?.state).toBe("done");
    expect(s.find((x) => x.key === "claim_open")?.state).toBe("done");
    expect(current(s)?.label).toBe("รอช่างตรวจสอบ");
  });

  it("refunded > mechanic-approved (approver note) then คืนเงินแล้ว is current", () => {
    const s = orderStages("claimed", "refunded");
    expect(s.find((x) => x.key === "claim_review")).toMatchObject({
      label: "อนุมัติการเคลม",
      note: "อนุมัติโดย L",
    });
    expect(current(s)?.label).toBe("คืนเงินแล้ว");
  });

  it("claim rejected > ปฏิเสธการเคลม is current with a rejected-by note", () => {
    const s = orderStages("claim_rejected", "paid");
    expect(current(s)).toMatchObject({ label: "ปฏิเสธการเคลม", note: "ปฏิเสธโดย L" });
  });

  it("dates > come from matching history events; upcoming steps have none", () => {
    const s = orderStages("confirmed", "paid", [
      { event: "created", at: 1000 },
      { event: "confirmed", at: 3000 },
    ]);
    expect(s.find((x) => x.key === "placed")?.at).toBe(1000);
    expect(s.find((x) => x.key === "to_ship")?.at).toBe(3000);
    expect(s.find((x) => x.key === "in_transit")?.at).toBeNull();
  });
});
