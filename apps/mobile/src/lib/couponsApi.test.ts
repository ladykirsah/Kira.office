import { describe, expect, it } from "vitest";
import { createCoupon, deleteCoupon, fetchCoupons, updateCoupon } from "./couponsApi";
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

describe("fetchCoupons", () => {
  it("given the page opens > then it reads every coupon, signed in", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ coupons: [{ id: "c1" }] }));
    expect(await fetchCoupons(fetchFn, "http://api", "tok")).toEqual([{ id: "c1" }]);
    expect(calls[0]!.url).toBe("http://api/coupons");
    expect(signed(calls[0]!.init)).toBe(true);
  });

  it("given the server fails > then it throws, so the page offers ลองอีกครั้ง", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "down" }, { status: 500 }));
    await expect(fetchCoupons(fetchFn, "http://api", "tok")).rejects.toThrow();
  });
});

describe("createCoupon", () => {
  it("given a new coupon > then it posts the body and returns the new id", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ id: "new" }, { status: 201 }));
    expect(await createCoupon(fetchFn, "http://api", "tok", { code: "A1" })).toEqual({ id: "new" });
    expect(calls[0]!.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ code: "A1" });
    expect(signed(calls[0]!.init)).toBe(true);
  });

  it("given another coupon has the code (409) > then it says taken, for the line under โค้ด", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "coupon code A1 already exists" }, { status: 409 }),
    );
    expect(await createCoupon(fetchFn, "http://api", "tok", { code: "A1" })).toEqual({
      taken: true,
    });
  });

  it("given any other refusal > then the server's reason comes back", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "name is required" }, { status: 400 }),
    );
    await expect(createCoupon(fetchFn, "http://api", "tok", {})).rejects.toThrow(
      "name is required",
    );
  });
});

describe("updateCoupon", () => {
  it("given an edit > then PATCH on that coupon", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await updateCoupon(fetchFn, "http://api", "tok", "a b", { status: "disabled" });
    expect(calls[0]!.url).toBe("http://api/coupons/a%20b");
    expect(calls[0]!.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ status: "disabled" });
  });

  it("given a refusal > then it throws", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "no" }, { status: 400 }));
    await expect(updateCoupon(fetchFn, "http://api", "tok", "c1", {})).rejects.toThrow("no");
  });
});

describe("deleteCoupon", () => {
  it("given an unused coupon > then DELETE, and it is gone", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    expect(await deleteCoupon(fetchFn, "http://api", "tok", "c1")).toBe("deleted");
    expect(calls[0]!.url).toBe("http://api/coupons/c1");
    expect(calls[0]!.init?.method).toBe("DELETE");
    expect(signed(calls[0]!.init)).toBe(true);
  });

  it("given someone used it meanwhile (409) > then used, so the page says ปิดใช้ในแก้ไขแทน", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "coupon has 1 redemption(s)" }, { status: 409 }),
    );
    expect(await deleteCoupon(fetchFn, "http://api", "tok", "c1")).toBe("used");
  });

  it("given the server fails > then it throws", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "down" }, { status: 500 }));
    await expect(deleteCoupon(fetchFn, "http://api", "tok", "c1")).rejects.toThrow();
  });
});
