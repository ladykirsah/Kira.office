import { describe, it, expect } from "vitest";
import { parseCsv, orderKey, dedupeOrders } from "./orders";

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
