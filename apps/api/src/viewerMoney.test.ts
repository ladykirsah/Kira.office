import { describe, expect, it } from "vitest";
import {
  saleNumbersOnly,
  withoutLineCost,
  withoutOrderDetailCost,
  withoutOrderProfit,
  withoutProductCost,
} from "./viewerMoney";

describe("withoutProductCost", () => {
  it("given a product with sizes > zeroes the product's cost and every size's, keeps the prices", () => {
    const out = withoutProductCost({
      name: "โอริง",
      pricing: { itemCostSatang: 1200, onlinePriceSatang: 3000 },
      choices: [
        { value: "3/8", pricing: { itemCostSatang: 1100, onlinePriceSatang: 3000 } },
        { value: "1/2", pricing: null },
      ],
    });
    expect(out.pricing).toEqual({ itemCostSatang: 0, onlinePriceSatang: 3000 });
    expect(out.choices.map((c) => c.pricing)).toEqual([
      { itemCostSatang: 0, onlinePriceSatang: 3000 },
      null,
    ]);
    expect(out.name).toBe("โอริง");
  });

  it("given a product with no pricing and no sizes > sends it unchanged", () => {
    expect(withoutProductCost({ pricing: null })).toEqual({ pricing: null });
  });
});

describe("withoutLineCost", () => {
  it("given a bill > every line's cost is 0, prices stay", () => {
    const out = withoutLineCost({
      saleNumber: "B-1",
      lines: [
        { unitPriceSatang: 5000, unitCostSatang: 3200 },
        { unitPriceSatang: 800, unitCostSatang: null },
      ],
    });
    expect(out.lines).toEqual([
      { unitPriceSatang: 5000, unitCostSatang: 0 },
      { unitPriceSatang: 800, unitCostSatang: 0 },
    ]);
    expect(out.saleNumber).toBe("B-1");
  });
});

describe("withoutOrderProfit", () => {
  it("given orders > each profit becomes null (shown as —)", () => {
    expect(
      withoutOrderProfit([
        { id: "o1", profitSatang: 4500 },
        { id: "o2", profitSatang: null },
      ]),
    ).toEqual([
      { id: "o1", profitSatang: null },
      { id: "o2", profitSatang: null },
    ]);
  });
});

describe("withoutOrderDetailCost", () => {
  it("given an order page > its profit, item cost and line costs are withheld", () => {
    const out = withoutOrderDetailCost({
      order: { id: "o1", profitSatang: 4500, grandTotalSatang: 10000 },
      money: { itemCostSatang: 5000, profitSatang: 4500, customerPaidSatang: 10000 },
      lines: [{ id: "l1", unitCostSatang: 5000, unitPriceSatang: 9500 }],
    });
    expect(out.order).toEqual({ id: "o1", profitSatang: null, grandTotalSatang: 10000 });
    expect(out.money).toEqual({ itemCostSatang: 0, profitSatang: null, customerPaidSatang: 10000 });
    expect(out.lines).toEqual([{ id: "l1", unitCostSatang: 0, unitPriceSatang: 9500 }]);
  });
});

describe("saleNumbersOnly", () => {
  it("given bills with money > keeps only each bill number", () => {
    const bills: {
      saleNumber: string | null;
      grandTotalSatang: number;
      grossProfitSatang: number;
    }[] = [
      { saleNumber: "B-1", grandTotalSatang: 5000, grossProfitSatang: 1800 },
      { saleNumber: null, grandTotalSatang: 0, grossProfitSatang: 0 },
    ];
    expect(saleNumbersOnly(bills)).toEqual([{ saleNumber: "B-1" }, { saleNumber: null }]);
  });
});
