import { describe, expect, it } from "vitest";
import {
  addChoice,
  addToGroup,
  removeChoice,
  removeFromGroup,
  renameOption,
  setUpOptions,
  updateChoice,
  uploadChoicePhoto,
} from "./choicesApi";
import type { ChoiceBody } from "./productChoices";
import type { FetchFn } from "./signIn";

/** The calls หน้าสินค้า's ตัวเลือกสินค้า and กลุ่มสินค้า make (7 Nov 2026). */

function replying(reply: () => Response) {
  const calls: { url: string; method: string; body: unknown; headers: Record<string, string> }[] =
    [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
      headers: init.headers as Record<string, string>,
    });
    return reply();
  };
  return { calls, fetchFn };
}

const BODY: ChoiceBody = {
  value: "1/2 กลาง",
  code: "TG949142-00204D",
  pricing: {
    itemCostSatang: 1200,
    taxOnCost: false,
    targetPriceSatang: 4500,
    b2bPriceSatang: 2500,
    onlinePriceSatang: 3000,
    shopeePriceSatang: 3000,
    onlineCommissionBp: 0,
  },
};

describe("choicesApi > what each call sends", () => {
  it("given the first sheet saved > then POST the option name and its values for that product", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }, { status: 201 }));
    expect(await setUpOptions(fetchFn, "http://api", "tok", "p 1", "ขนาด", ["3/8 เล็ก"])).toEqual({
      ok: true,
    });
    expect(calls[0]).toMatchObject({
      url: "http://api/products/p%201/options",
      method: "POST",
      body: { name: "ขนาด", values: ["3/8 เล็ก"] },
    });
  });

  it("given ชื่อกลุ่ม changed > then PUT the new name", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await renameOption(fetchFn, "http://api", "tok", "p1", "ไซซ์");
    expect(calls[0]).toMatchObject({ method: "PUT", body: { name: "ไซซ์" } });
  });

  it("given a new size saved > then POST it and get its new id back", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ variantId: "v9" }, { status: 201 }));
    expect(await addChoice(fetchFn, "http://api", "tok", "p1", BODY)).toEqual({
      ok: true,
      variantId: "v9",
    });
    expect(calls[0]).toMatchObject({ url: "http://api/products/p1/choices", body: BODY });
  });

  it("given a size edited, then removed > then PUT and DELETE that size", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await updateChoice(fetchFn, "http://api", "tok", "p1", "v2", BODY);
    await removeChoice(fetchFn, "http://api", "tok", "p1", "v2");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "PUT http://api/products/p1/choices/v2",
      "DELETE http://api/products/p1/choices/v2",
    ]);
  });

  it("given the size's photo > then the picture itself goes up, with its type", async () => {
    const { calls, fetchFn } = replying(() =>
      Response.json({ imageKey: "products/p1/x.jpg" }, { status: 201 }),
    );
    const photo = new Blob(["x"], { type: "image/png" });
    expect(await uploadChoicePhoto(fetchFn, "http://api", "tok", "p1", "v2", photo)).toBe(
      "products/p1/x.jpg",
    );
    expect(calls[0]!.url).toBe("http://api/products/p1/choices/v2/image");
    expect(calls[0]!.headers["content-type"]).toBe("image/png");
  });

  it("given products picked, then one taken out > then POST the ids, then DELETE that member", async () => {
    const { calls, fetchFn } = replying(() => Response.json({ ok: true }));
    await addToGroup(fetchFn, "http://api", "tok", "p1", ["a", "b"]);
    await removeFromGroup(fetchFn, "http://api", "tok", "p1", "a");
    expect(calls[0]).toMatchObject({
      url: "http://api/products/p1/group",
      body: { productIds: ["a", "b"] },
    });
    expect(calls[1]).toMatchObject({ url: "http://api/products/p1/group/a", method: "DELETE" });
  });
});

describe("choicesApi > refusals and failures", () => {
  it("given the server refuses with a reason > then the reason comes back, to show under its box", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "code_taken", reason: "code_taken" }, { status: 409 }),
    );
    expect(await addChoice(fetchFn, "http://api", "tok", "p1", BODY)).toEqual({
      ok: false,
      reason: "code_taken",
    });
  });

  it("given the owner-only price refusal > then its reason comes back too", async () => {
    const { fetchFn } = replying(() =>
      Response.json({ error: "Only the shop owner…", reason: "price_is_owners" }, { status: 403 }),
    );
    expect(await updateChoice(fetchFn, "http://api", "tok", "p1", "v1", BODY)).toEqual({
      ok: false,
      reason: "price_is_owners",
    });
  });

  it("given a broken server > then it throws, so the page says it did not save", async () => {
    const { fetchFn } = replying(() => new Response("boom", { status: 500 }));
    await expect(removeChoice(fetchFn, "http://api", "tok", "p1", "v1")).rejects.toThrow();
  });
});
