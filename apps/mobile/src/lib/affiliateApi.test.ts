import { describe, expect, it } from "vitest";
import {
  createCategory,
  createItem,
  deleteItem,
  fetchAffiliate,
  fetchLinkPrice,
  updateItem,
  uploadItemImage,
} from "./affiliateApi";
import type { FetchFn } from "./signIn";

function replying(reply: (url: string) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url: String(url), init });
    return reply(String(url));
  };
  return { calls, fetchFn };
}

const signed = (init?: RequestInit) => JSON.stringify(init?.headers ?? {}).includes("tok");

describe("fetchAffiliate", () => {
  it("given the page opens > then it reads the cards and the categories, signed in", async () => {
    const { calls, fetchFn } = replying((url) =>
      url.endsWith("/affiliate-items")
        ? Response.json({ items: [{ id: "a1" }] })
        : Response.json({ categories: [{ id: "c1", name: "เกจวัด", sortOrder: 0 }] }),
    );
    const out = await fetchAffiliate(fetchFn, "http://api", "tok");
    expect(out.items).toEqual([{ id: "a1" }]);
    expect(out.categories.map((c) => c.name)).toEqual(["เกจวัด"]);
    expect(calls.map((c) => c.url).sort()).toEqual([
      "http://api/affiliate-categories",
      "http://api/affiliate-items",
    ]);
    expect(calls.every((c) => signed(c.init))).toBe(true);
  });

  it("given the server fails > then it says so", async () => {
    const { fetchFn } = replying(() => new Response("x", { status: 500 }));
    await expect(fetchAffiliate(fetchFn, "http://api", "tok")).rejects.toThrow();
  });
});

describe("saving a card", () => {
  it("given a new card > then POST, and its id back", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ id: "new1" }, { status: 201 }));
    const id = await createItem(fetchFn, "http://api", "tok", { title: "x" });
    expect(id).toBe("new1");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.url).toBe("http://api/affiliate-items");
  });

  it("given an edit or a delete > then PATCH / DELETE that card", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await updateItem(fetchFn, "http://api", "tok", "a 1", { categoryId: "c1" });
    await deleteItem(fetchFn, "http://api", "tok", "a 1");
    expect(calls.map((c) => [c.init?.method, c.url])).toEqual([
      ["PATCH", "http://api/affiliate-items/a%201"],
      ["DELETE", "http://api/affiliate-items/a%201"],
    ]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ categoryId: "c1" });
  });

  it("given the server refuses > then its words come back", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "targetUrl must be an https:// link" }, { status: 400 }),
    );
    await expect(createItem(fetchFn, "http://api", "tok", {})).rejects.toThrow(
      "targetUrl must be an https:// link",
    );
  });

  it("given a photo > then it is sent as itself and its key comes back", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({ key: "affiliate/a1-x.png", url: "/img/affiliate/a1-x.png" }, { status: 201 }),
    );
    const photo = new Blob(["png"], { type: "image/png" });
    expect(await uploadItemImage(fetchFn, "http://api", "tok", "a1", photo)).toBe(
      "affiliate/a1-x.png",
    );
    expect(calls[0]?.url).toBe("http://api/affiliate-items/a1/image");
    expect(JSON.stringify(calls[0]?.init?.headers)).toContain("image/png");
  });

  it("given a new category name > then POST it and get the category back", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({ id: "c9", name: "ปั๊ม" }, { status: 201 }),
    );
    expect(await createCategory(fetchFn, "http://api", "tok", "ปั๊ม")).toEqual({
      id: "c9",
      name: "ปั๊ม",
    });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ name: "ปั๊ม" });
  });
});

describe("fetchLinkPrice", () => {
  it("given a link > then the server is asked for its price", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ price: "฿1,965" }));
    const link = "https://s.lazada.co.th/s.ZkQ2c";
    expect(await fetchLinkPrice(fetchFn, "http://api", "tok", link)).toBe("฿1,965");
    expect(calls[0]?.url).toBe(`http://api/affiliate-price?url=${encodeURIComponent(link)}`);
  });

  it("given no price or a failure > then null, never an error", async () => {
    const none = replying(() => Response.json({ price: null }));
    expect(await fetchLinkPrice(none.fetchFn, "http://api", "tok", "https://x")).toBeNull();
    const broken: FetchFn = async () => {
      throw new TypeError("offline");
    };
    expect(await fetchLinkPrice(broken, "http://api", "tok", "https://x")).toBeNull();
    const refused = replying(() => new Response("x", { status: 500 }));
    expect(await fetchLinkPrice(refused.fetchFn, "http://api", "tok", "https://x")).toBeNull();
  });
});
