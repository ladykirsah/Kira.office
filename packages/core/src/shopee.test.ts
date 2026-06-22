import { describe, it, expect } from "vitest";
import { computeShopeeStockUpdates } from "./shopee";

describe("computeShopeeStockUpdates", () => {
  it("updates only linked models whose local available differs from last-synced", () => {
    const updates = computeShopeeStockUpdates(
      { v1: 18, v2: 5, v3: 0 },
      [
        { productVariantId: "v1", shopeeModelId: "m1" },
        { productVariantId: "v2", shopeeModelId: "m2" },
        { productVariantId: "v3", shopeeModelId: "m3" },
      ],
      { m1: 20, m2: 5 },
    );
    expect(updates).toEqual([
      { shopeeModelId: "m1", newStock: 18 }, // 18 != 20 -> update
      { shopeeModelId: "m3", newStock: 0 }, // never synced -> push 0
    ]);
    // m2 unchanged (5 == 5) -> skipped
  });

  it("ignores variants with no Shopee link", () => {
    const updates = computeShopeeStockUpdates(
      { v1: 10, unlinked: 99 },
      [{ productVariantId: "v1", shopeeModelId: "m1" }],
      {},
    );
    expect(updates).toEqual([{ shopeeModelId: "m1", newStock: 10 }]);
  });
});
