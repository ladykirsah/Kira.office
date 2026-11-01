import { describe, expect, it } from "vitest";
import { createSale, deleteSale, fetchSales, updateSale } from "./flashApi";
import type { FetchFn } from "./signIn";

function replying(reply: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url: String(url), init });
    return reply(String(url), init);
  };
  return { calls, fetchFn };
}

const signed = (init?: RequestInit) => JSON.stringify(init?.headers ?? {}).includes("tok");

describe("fetchSales", () => {
  it("given the page opens > then it reads every sale, signed in", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ campaigns: [{ id: "k1" }] }));
    expect(await fetchSales(fetchFn, "http://api", "tok")).toEqual([{ id: "k1" }]);
    expect(calls[0]!.url).toBe("http://api/campaigns");
    expect(signed(calls[0]!.init)).toBe(true);
  });

  it("given the server fails > then it throws, so the page offers ลองอีกครั้ง", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "down" }, { status: 500 }));
    await expect(fetchSales(fetchFn, "http://api", "tok")).rejects.toThrow();
  });
});

describe("createSale", () => {
  it("given a new sale > then it posts it with its products and returns the id", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ id: "new" }, { status: 201 }));
    const body = { name: "x", prices: [{ productVariantId: "v1" }] };
    expect(await createSale(fetchFn, "http://api", "tok", body)).toBe("new");
    expect(calls[0]!.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual(body);
    expect(signed(calls[0]!.init)).toBe(true);
  });

  it("given the server refuses > then it throws with the server's words", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "nope" }, { status: 409 }));
    await expect(createSale(fetchFn, "http://api", "tok", {})).rejects.toThrow("nope");
  });
});

describe("updateSale", () => {
  it("given an edit > then it patches that sale", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await updateSale(fetchFn, "http://api", "tok", "k 1", { name: "y" });
    expect(calls[0]!.url).toBe("http://api/campaigns/k%201");
    expect(calls[0]!.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ name: "y" });
  });

  it("given the server fails > then it throws", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "x" }, { status: 400 }));
    await expect(updateSale(fetchFn, "http://api", "tok", "k1", {})).rejects.toThrow();
  });
});

describe("deleteSale", () => {
  it("given ลบ > then it deletes that sale, signed in", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await deleteSale(fetchFn, "http://api", "tok", "k1");
    expect(calls[0]!.url).toBe("http://api/campaigns/k1");
    expect(calls[0]!.init?.method).toBe("DELETE");
    expect(signed(calls[0]!.init)).toBe(true);
  });

  it("given the server fails > then it throws", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "x" }, { status: 500 }));
    await expect(deleteSale(fetchFn, "http://api", "tok", "k1")).rejects.toThrow();
  });
});
