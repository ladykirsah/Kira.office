import { describe, expect, it } from "vitest";
import { fetchShopeeWorklist, markShopeeSynced } from "./homeApi";
import type { FetchFn } from "./signIn";

function recording(reply: () => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    return reply();
  };
  return { calls, fetchFn };
}

const ITEM = {
  productId: "p1",
  productRef: "DN-447220",
  name: "คอมเพรสเซอร์ DENSO 10S11C",
  onHand: 3,
  deltaSinceSync: -2,
  lastChangedAt: 1,
};

describe("fetchShopeeWorklist", () => {
  it("given a signed-in phone > then the products still owed a Shopee update", async () => {
    const { calls, fetchFn } = recording(async () => Response.json({ items: [ITEM] }));

    const items = await fetchShopeeWorklist(fetchFn, "http://api", "tok");

    expect(items).toEqual([ITEM]);
    expect(calls[0]?.url).toBe("http://api/stock/shopee-worklist");
    expect((calls[0]?.init.headers as Record<string, string>)["X-Staff-Session"]).toBe("tok");
  });

  it("given the server fails > then it throws, never an empty list ('no work' ≠ 'couldn't look')", async () => {
    const { fetchFn } = recording(async () => new Response("down", { status: 500 }));

    await expect(fetchShopeeWorklist(fetchFn, "http://api", "tok")).rejects.toThrow();
  });
});

describe("markShopeeSynced", () => {
  it("given ticked products > then it posts their ids", async () => {
    const { calls, fetchFn } = recording(async () => Response.json({ ok: true, updated: 2 }));

    await markShopeeSynced(fetchFn, "http://api", "tok", ["p1", "p2"]);

    expect(calls[0]?.url).toBe("http://api/stock/shopee-synced");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ productIds: ["p1", "p2"] });
  });

  it("given the server refuses > then it throws so the ticks stay", async () => {
    const { fetchFn } = recording(async () => new Response("no", { status: 503 }));

    await expect(markShopeeSynced(fetchFn, "http://api", "tok", ["p1"])).rejects.toThrow();
  });
});
