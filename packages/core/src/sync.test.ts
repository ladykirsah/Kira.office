import { describe, it, expect } from "vitest";
import { partitionByClientUuid } from "./sync";

describe("partitionByClientUuid > offline-sync idempotency", () => {
  it("splits incoming into fresh vs already-applied", () => {
    const r = partitionByClientUuid(
      ["a"],
      [{ clientUuid: "a" }, { clientUuid: "b" }, { clientUuid: "c" }],
    );
    expect(r.fresh.map((s) => s.clientUuid)).toEqual(["b", "c"]);
    expect(r.duplicates.map((s) => s.clientUuid)).toEqual(["a"]);
  });

  it("treats repeats within the same batch as duplicates (apply once)", () => {
    const r = partitionByClientUuid(
      [],
      [{ clientUuid: "x" }, { clientUuid: "x" }, { clientUuid: "y" }],
    );
    expect(r.fresh.map((s) => s.clientUuid)).toEqual(["x", "y"]);
    expect(r.duplicates.map((s) => s.clientUuid)).toEqual(["x"]);
  });

  it("empty incoming > empty partitions", () => {
    const r = partitionByClientUuid(["a"], []);
    expect(r.fresh).toEqual([]);
    expect(r.duplicates).toEqual([]);
  });

  it("preserves the original sale objects in fresh", () => {
    const sale = { clientUuid: "z", amountSatang: 10700 };
    const r = partitionByClientUuid([], [sale]);
    expect(r.fresh[0]).toBe(sale);
  });
});
