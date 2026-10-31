import { describe, expect, it } from "vitest";
import {
  addLabel,
  copiesOf,
  labelCount,
  removeLabel,
  setLabelQty,
  type SheetItem,
} from "./labelList";

const empty: SheetItem[] = [];

describe("addLabel", () => {
  it("given an empty sheet > then the product's labels go on, at the size and amount chosen", () => {
    expect(addLabel(empty, "p1", "L", 4)).toEqual([
      { key: "p1:L", productId: "p1", size: "L", qty: 4 },
    ]);
  });

  it("given the same product at another size > then a second item (L and S of one part)", () => {
    const two = addLabel(addLabel(empty, "p1", "L", 4), "p1", "S", 2);
    expect(two.map((i) => i.key)).toEqual(["p1:L", "p1:S"]);
  });

  it("given the same product at the same size again > then its amount grows, no second item", () => {
    expect(addLabel(addLabel(empty, "p1", "L", 4), "p1", "L", 2)).toEqual([
      { key: "p1:L", productId: "p1", size: "L", qty: 6 },
    ]);
  });

  it("given an amount below 1 > then 1, never an empty item", () => {
    expect(addLabel(empty, "p1", "S", 0)[0]!.qty).toBe(1);
  });

  it("never changes the list it was given", () => {
    const before = addLabel(empty, "p1", "L", 4);
    addLabel(before, "p1", "L", 2);
    expect(before[0]!.qty).toBe(4);
  });
});

describe("setLabelQty", () => {
  it("given a new amount > then that item only changes", () => {
    const list = addLabel(addLabel(empty, "p1", "L", 4), "p2", "S", 1);
    expect(setLabelQty(list, "p2:S", 3).map((i) => i.qty)).toEqual([4, 3]);
  });

  it("given 0 > then it stays at 1 (removing is the label sheet's ลบออกจากแผ่น)", () => {
    expect(setLabelQty(addLabel(empty, "p1", "L", 2), "p1:L", 0)[0]!.qty).toBe(1);
  });
});

describe("removeLabel", () => {
  it("given an item > then it leaves the sheet, the rest keep their order", () => {
    const list = addLabel(addLabel(addLabel(empty, "a", "L", 1), "b", "L", 1), "c", "S", 1);
    expect(removeLabel(list, "b:L").map((i) => i.key)).toEqual(["a:L", "c:S"]);
  });
});

describe("copiesOf and labelCount", () => {
  it("given items with amounts > then one entry per printed label, in list order", () => {
    const list = addLabel(addLabel(empty, "a", "L", 2), "b", "S", 1);
    const lines = (id: string) => (id === "a" ? 3 : 1);
    expect(copiesOf(list, lines)).toEqual([
      { size: "L", lines: 3, item: "a:L" },
      { size: "L", lines: 3, item: "a:L" },
      { size: "S", lines: 1, item: "b:S" },
    ]);
    expect(labelCount(list)).toBe(3);
  });
});
