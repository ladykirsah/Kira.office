import { describe, it, expect } from "vitest";
import {
  parseCsv,
  orderKey,
  dedupeOrders,
  normalizeSku,
  matchLineVariant,
  planOnlineDeductions,
  type ShopeeOrderLine,
} from "./orders";

const line = (over: Partial<ShopeeOrderLine> = {}): ShopeeOrderLine => ({
  externalOrderId: "O1",
  productName: "DENSO O-ring",
  variationName: "3/8",
  externalSku: "TG949142-0010D",
  parentSku: "",
  quantity: 1,
  ...over,
});

describe("normalizeSku", () => {
  it("trims and uppercases for tolerant matching", () => {
    expect(normalizeSku("  tg949142-0010d ")).toBe("TG949142-0010D");
  });
});

describe("matchLineVariant", () => {
  const bySku = new Map([
    ["TG949142-0010D", "v-oring-38"],
    ["UTT017", "v-vinn-mighty"],
  ]);

  it("matches on the variation SKU", () => {
    expect(matchLineVariant({ externalSku: "TG949142-0010D", parentSku: "" }, bySku)).toBe(
      "v-oring-38",
    );
  });

  it("matches case/space-insensitively", () => {
    expect(matchLineVariant({ externalSku: " tg949142-0010d ", parentSku: "" }, bySku)).toBe(
      "v-oring-38",
    );
  });

  it("falls back to Parent SKU when the variation SKU is blank", () => {
    expect(matchLineVariant({ externalSku: "", parentSku: "UTT017" }, bySku)).toBe("v-vinn-mighty");
  });

  it("returns null when neither SKU matches", () => {
    expect(matchLineVariant({ externalSku: "NOPE", parentSku: "" }, bySku)).toBeNull();
  });
});

describe("planOnlineDeductions", () => {
  const bySku = new Map([["TG949142-0010D", "v-oring-38"]]);

  it("deducts matched lines and flags the rest", () => {
    const lines = [
      line({ externalSku: "TG949142-0010D", quantity: 4 }),
      line({ externalSku: "UNKNOWN", quantity: 2, variationName: "?" }),
    ];
    const out = planOnlineDeductions(lines, bySku);
    expect(out.deductions).toEqual([{ variantId: "v-oring-38", quantity: 4 }]);
    expect(out.unmatched).toHaveLength(1);
    expect(out.unmatched[0]?.externalSku).toBe("UNKNOWN");
  });

  it("never deducts a non-positive quantity", () => {
    const out = planOnlineDeductions([line({ quantity: 0 })], bySku);
    expect(out.deductions).toEqual([]);
    expect(out.unmatched).toHaveLength(1);
  });
});

describe("parseCsv", () => {
  it("parses simple comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('"a,b",c')).toEqual([["a,b", "c"]]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('"a""b",c')).toEqual([['a"b', "c"]]);
  });

  it("handles CRLF rows and newlines inside quotes", () => {
    expect(parseCsv('x,"line1\nline2"\r\ny,z')).toEqual([
      ["x", "line1\nline2"],
      ["y", "z"],
    ]);
  });

  it("ignores a single trailing newline", () => {
    expect(parseCsv("a,b\n")).toEqual([["a", "b"]]);
  });
});

describe("orderKey / dedupeOrders > (channel, external_order_id) uniqueness", () => {
  it("orderKey is stable per (channel, id) and distinguishes different ids", () => {
    expect(orderKey({ channel: "shopee", externalOrderId: "200101" })).toBe(
      orderKey({ channel: "shopee", externalOrderId: "200101" }),
    );
    expect(orderKey({ channel: "shopee", externalOrderId: "1" })).not.toBe(
      orderKey({ channel: "shopee", externalOrderId: "2" }),
    );
  });

  it("does not collide across channels with the same id", () => {
    expect(orderKey({ channel: "shopee", externalOrderId: "1" })).not.toBe(
      orderKey({ channel: "lazada", externalOrderId: "1" }),
    );
  });

  it("drops already-imported and in-batch duplicate orders", () => {
    const existing = [orderKey({ channel: "shopee", externalOrderId: "A" })];
    const r = dedupeOrders(existing, [
      { channel: "shopee", externalOrderId: "A" },
      { channel: "shopee", externalOrderId: "B" },
      { channel: "shopee", externalOrderId: "B" },
    ]);
    expect(r.fresh.map((o) => o.externalOrderId)).toEqual(["B"]);
    expect(r.duplicates.map((o) => o.externalOrderId)).toEqual(["A", "B"]);
  });
});
