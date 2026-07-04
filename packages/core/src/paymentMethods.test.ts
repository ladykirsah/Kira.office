import { describe, it, expect } from "vitest";
import {
  parsePaymentMethods,
  defaultPaymentMethod,
  serializePaymentMethods,
  type PaymentMethod,
} from "./paymentMethods";

const m = (
  id: string,
  label: string,
  promptpayId: string,
  isDefault?: boolean,
  position = "",
): PaymentMethod => ({
  id,
  position,
  label,
  promptpayId,
  ...(isDefault !== undefined ? { isDefault } : {}),
});

describe("parsePaymentMethods", () => {
  it("round-trips a valid list (with position)", () => {
    const json = JSON.stringify([
      { id: "a", position: "เจ้าของ", label: "ร้าน", promptpayId: "0812345678", isDefault: true },
      { id: "b", position: "พนักงาน", label: "แม่", promptpayId: "1234567890123" },
    ]);
    expect(parsePaymentMethods(json)).toEqual([
      m("a", "ร้าน", "0812345678", true, "เจ้าของ"),
      m("b", "แม่", "1234567890123", undefined, "พนักงาน"),
    ]);
  });

  it("defaults a missing position to '' (backward compatible with older saved data)", () => {
    const json = JSON.stringify([{ id: "a", label: "ร้าน", promptpayId: "0812345678" }]);
    expect(parsePaymentMethods(json)[0]?.position).toBe("");
  });

  it("returns [] for blank, bad JSON, or a non-array", () => {
    expect(parsePaymentMethods("")).toEqual([]);
    expect(parsePaymentMethods(null)).toEqual([]);
    expect(parsePaymentMethods("not json{")).toEqual([]);
    expect(parsePaymentMethods('{"a":1}')).toEqual([]);
  });

  it("drops entries missing a label or promptpayId", () => {
    const json = JSON.stringify([
      { id: "a", label: "ร้าน", promptpayId: "0812345678" },
      { id: "b", label: "", promptpayId: "0899999999" },
      { id: "c", label: "พ่อ" },
      "junk",
    ]);
    expect(parsePaymentMethods(json)).toEqual([m("a", "ร้าน", "0812345678")]);
  });
});

describe("defaultPaymentMethod", () => {
  it("returns the flagged default", () => {
    const methods = [m("a", "ร้าน", "1"), m("b", "แม่", "2", true)];
    expect(defaultPaymentMethod(methods)?.id).toBe("b");
  });
  it("falls back to the first when none is flagged", () => {
    expect(defaultPaymentMethod([m("a", "ร้าน", "1"), m("b", "แม่", "2")])?.id).toBe("a");
  });
  it("returns null for an empty list", () => {
    expect(defaultPaymentMethod([])).toBeNull();
  });
});

describe("serializePaymentMethods", () => {
  it("normalizes to exactly one default (first flagged wins)", () => {
    const out = parsePaymentMethods(
      serializePaymentMethods([
        m("a", "ร้าน", "1"),
        m("b", "แม่", "2", true),
        m("c", "พ่อ", "3", true),
      ]),
    );
    expect(out.map((x) => !!x.isDefault)).toEqual([false, true, false]);
  });
  it("makes the first the default when none is flagged", () => {
    const out = parsePaymentMethods(
      serializePaymentMethods([m("a", "ร้าน", "1"), m("b", "แม่", "2")]),
    );
    expect(out.map((x) => !!x.isDefault)).toEqual([true, false]);
  });
  it("serializes an empty list to an empty JSON array", () => {
    expect(serializePaymentMethods([])).toBe("[]");
  });

  it("preserves position through serialize → parse", () => {
    const out = parsePaymentMethods(
      serializePaymentMethods([m("a", "แม่", "0899999999", true, "เจ้าของ")]),
    );
    expect(out[0]?.position).toBe("เจ้าของ");
  });
});
