import { describe, expect, it } from "vitest";
import { fetchMovements } from "./stockApi";
import type { FetchFn } from "./signIn";

function replying(reply: () => Promise<Response>) {
  const urls: string[] = [];
  const fetchFn: FetchFn = async (url) => {
    urls.push(url);
    return reply();
  };
  return { urls, fetchFn };
}

const SALE = {
  id: "m1",
  variantId: "v1",
  sku: "DN-447220",
  productName: "คอมเพรสเซอร์ DENSO 10S11C",
  productRef: "DN-447220",
  imageKey: "k1",
  movementType: "onsite_sale",
  quantityDelta: -1,
  quantityAfter: 4,
  salePriceSatang: 345000,
  createdAt: 1000,
};

describe("fetchMovements", () => {
  it("given no dates > then it asks for the latest changes and returns them with the list's limit", async () => {
    const { urls, fetchFn } = replying(async () =>
      Response.json({ movements: [SALE], limit: 100 }),
    );
    expect(await fetchMovements(fetchFn, "http://api", "tok", null)).toEqual({
      movements: [SALE],
      limit: 100,
    });
    expect(urls).toEqual(["http://api/stock/movements"]);
  });

  it("given a period > then it sends both ends of it", async () => {
    const { urls, fetchFn } = replying(async () => Response.json({ movements: [], limit: 500 }));
    await fetchMovements(fetchFn, "http://api", "tok", { start: 1000, end: 2000 });
    expect(urls).toEqual(["http://api/stock/movements?from=1000&to=2000"]);
  });

  it("given the server fails > then it says so instead of showing an empty history", async () => {
    const { fetchFn } = replying(async () => new Response("nope", { status: 500 }));
    await expect(fetchMovements(fetchFn, "http://api", "tok", null)).rejects.toThrow();
  });
});
