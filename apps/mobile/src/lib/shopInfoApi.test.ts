import { describe, expect, it } from "vitest";
import { fetchShop, fetchShopInfo, saveShopFields, uploadShopImage } from "./shopInfoApi";
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

describe("fetchShopInfo", () => {
  it("given a shop > then it reads that shop's details, signed in", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({ profile: "airplus", name: "AirPlus", logoKey: "shop/a.png", qrKey: null }),
    );
    const info = await fetchShopInfo(fetchFn, "http://api", "tok", "airplus");
    expect(calls[0]!.url).toBe("http://api/shop-info/airplus");
    expect(signed(calls[0]!.init)).toBe(true);
    expect(info.name).toBe("AirPlus");
    expect(info.logoKey).toBe("shop/a.png");
  });

  it("given an older server without a field (Linktree) > then the field reads empty, not missing", async () => {
    const { fetchFn } = replying(() => Response.json({ name: "AirPlus" }));
    const info = await fetchShopInfo(fetchFn, "http://api", "tok", "airplus");
    expect(info.linktreeUrl).toBe("");
    expect(info.qrKey).toBeNull();
  });

  it("given a bank account (plan 8.7) > then bank, name and number are read; none yet > empty", async () => {
    const { fetchFn } = replying(() =>
      Response.json({
        bankName: "กสิกรไทย",
        bankAccountName: "AirPlus",
        bankAccountNumber: "1234567890",
      }),
    );
    const info = await fetchShopInfo(fetchFn, "http://api", "tok", "airplus");
    expect([info.bankName, info.bankAccountName, info.bankAccountNumber]).toEqual([
      "กสิกรไทย",
      "AirPlus",
      "1234567890",
    ]);
    const none = replying(() => Response.json({ name: "AirPlus" }));
    expect((await fetchShopInfo(none.fetchFn, "http://api", "tok", "airplus")).bankName).toBe("");
  });

  it("given the server fails > then it throws, so the page offers ลองอีกครั้ง", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "down" }, { status: 500 }));
    await expect(fetchShopInfo(fetchFn, "http://api", "tok", "denair")).rejects.toThrow();
  });
});

describe("saveShopFields", () => {
  it("given changed fields > then it puts only those, signed in", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await saveShopFields(fetchFn, "http://api", "tok", "denair", { linktreeUrl: "linktr.ee/x" });
    expect(calls[0]!.url).toBe("http://api/shop-info/denair");
    expect(calls[0]!.init?.method).toBe("PUT");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ linktreeUrl: "linktr.ee/x" });
    expect(signed(calls[0]!.init)).toBe(true);
  });

  it("given the server fails > then it throws, so the page says บันทึกไม่สำเร็จ", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "down" }, { status: 500 }));
    await expect(saveShopFields(fetchFn, "http://api", "tok", "denair", {})).rejects.toThrow();
  });
});

describe("uploadShopImage", () => {
  it("given a logo photo > then it posts the picture with its type and returns the new key", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({ key: "shop/denair-logo-1.png", url: "/img/x" }, { status: 201 }),
    );
    const photo = new Blob(["x"], { type: "image/png" });
    expect(await uploadShopImage(fetchFn, "http://api", "tok", "denair", "logo", photo)).toBe(
      "shop/denair-logo-1.png",
    );
    expect(calls[0]!.url).toBe("http://api/shop-info/denair/logo");
    expect(calls[0]!.init?.method).toBe("POST");
    expect(JSON.stringify(calls[0]!.init?.headers)).toContain("image/png");
  });

  it("given a picture the server refuses (too big) > then it says wrong picture", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "image too large (max 5MB)" }, { status: 400 }),
    );
    const photo = new Blob(["x"], { type: "image/png" });
    await expect(
      uploadShopImage(fetchFn, "http://api", "tok", "denair", "qr", photo),
    ).resolves.toBe("wrong-picture");
  });
});

// Plan 10.3: which shop the app is open on, and the ข้อมูลร้าน cards it has.
describe("fetchShop", () => {
  it("given a signed-in app > then it reads the shop and its cards", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({ id: "coolair", name: "ร้านคูลแอร์", profiles: ["denair"] }),
    );
    const shop = await fetchShop(fetchFn, "http://api", "tok");
    expect(calls[0]!.url).toBe("http://api/shop");
    expect(signed(calls[0]!.init)).toBe(true);
    expect(shop).toEqual({ id: "coolair", name: "ร้านคูลแอร์", profiles: ["denair"] });
  });

  it("given a server from before shops (no /shop) > then Den Air with both cards, as before", async () => {
    const { fetchFn } = replying(() => new Response("Not Found", { status: 404 }));
    expect(await fetchShop(fetchFn, "http://api", "tok")).toEqual({
      id: "denair",
      name: "Den Air Service",
      profiles: ["denair", "airplus"],
    });
  });

  it("given a card the app doesn't know > then it is left out", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ id: "x", name: "X", profiles: ["denair", "somethingnew"] }),
    );
    expect((await fetchShop(fetchFn, "http://api", "tok")).profiles).toEqual(["denair"]);
  });

  it("given the server failing > then it says so", async () => {
    const { fetchFn } = replying(() => Response.json({ error: "boom" }, { status: 500 }));
    await expect(fetchShop(fetchFn, "http://api", "tok")).rejects.toThrow();
  });
});
