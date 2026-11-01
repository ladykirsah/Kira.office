import { describe, expect, it } from "vitest";
import {
  createBanner,
  deleteBanner,
  fetchBanners,
  reorderBanners,
  updateBanner,
  uploadBannerImage,
} from "./bannersApi";
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

describe("fetchBanners", () => {
  it("given the page opens > then it reads every banner, signed in", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ banners: [{ id: "b1" }] }));
    expect(await fetchBanners(fetchFn, "http://api", "tok")).toEqual([{ id: "b1" }]);
    expect(calls[0]!.url).toBe("http://api/banners");
    expect(signed(calls[0]!.init)).toBe(true);
  });

  it("given the server fails > then it throws, so the page offers ลองอีกครั้ง", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "down" }, { status: 500 }));
    await expect(fetchBanners(fetchFn, "http://api", "tok")).rejects.toThrow();
  });
});

describe("createBanner", () => {
  it("given a new banner > then it posts the body and returns the new id", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ id: "new" }, { status: 201 }));
    const id = await createBanner(fetchFn, "http://api", "tok", { slot: "hero" });
    expect(id).toBe("new");
    expect(calls[0]!.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ slot: "hero" });
  });

  it("given a refusal > then the server's reason comes back", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "slot must be hero or promo" }, { status: 400 }),
    );
    await expect(createBanner(fetchFn, "http://api", "tok", {})).rejects.toThrow(
      "slot must be hero or promo",
    );
  });
});

describe("updateBanner / deleteBanner", () => {
  it("given an edit > then PATCH on that banner, and DELETE to remove it", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await updateBanner(fetchFn, "http://api", "tok", "a b", { status: "disabled" });
    await deleteBanner(fetchFn, "http://api", "tok", "a b");
    expect(calls.map((c) => [c.init?.method, c.url])).toEqual([
      ["PATCH", "http://api/banners/a%20b"],
      ["DELETE", "http://api/banners/a%20b"],
    ]);
    expect(calls.every((c) => signed(c.init))).toBe(true);
  });

  it("given a delete the server refuses > then it throws", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "no" }, { status: 500 }));
    await expect(deleteBanner(fetchFn, "http://api", "tok", "b1")).rejects.toThrow();
  });
});

describe("reorderBanners", () => {
  it("given ▲ / ▼ > then one PATCH per moved row with its new place", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await reorderBanners(fetchFn, "http://api", "tok", [
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
    expect(calls.map((c) => [c.url, JSON.parse(String(c.init?.body))])).toEqual([
      ["http://api/banners/b", { sortOrder: 0 }],
      ["http://api/banners/a", { sortOrder: 1 }],
    ]);
  });

  it("given one of them fails > then it throws, so the list reloads the real order", async () => {
    const { fetchFn } = replying((url) =>
      url.endsWith("/a") ? Response.json({ error: "x" }, { status: 500 }) : Response.json({}),
    );
    await expect(
      reorderBanners(fetchFn, "http://api", "tok", [
        { id: "b", sortOrder: 0 },
        { id: "a", sortOrder: 1 },
      ]),
    ).rejects.toThrow();
  });
});

describe("uploadBannerImage", () => {
  it("given a picture > then it posts the bytes with their type and returns the key", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({ key: "banners/b1-x.png", url: "/img/banners/b1-x.png" }, { status: 201 }),
    );
    const photo = new Blob(["x"], { type: "image/png" });
    expect(await uploadBannerImage(fetchFn, "http://api", "tok", "b1", photo)).toBe(
      "banners/b1-x.png",
    );
    expect(calls[0]!.url).toBe("http://api/banners/b1/image");
    expect(JSON.stringify(calls[0]!.init?.headers)).toContain("image/png");
  });

  it("given a picture the server refuses > then it throws", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "image too large (max 5MB)" }, { status: 400 }),
    );
    await expect(
      uploadBannerImage(fetchFn, "http://api", "tok", "b1", new Blob(["x"])),
    ).rejects.toThrow("image too large");
  });
});
