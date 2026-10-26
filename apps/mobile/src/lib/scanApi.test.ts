import { describe, expect, it } from "vitest";
import { lookupPart, moveHold, parkBill, receiveStock } from "./scanApi";
import type { FetchFn } from "./signIn";

function recording(replies: Array<() => Promise<Response>>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    const reply = replies[calls.length - 1];
    if (!reply) throw new Error(`unexpected call ${url}`);
    return reply();
  };
  return { calls, fetchFn };
}

const found = {
  barcode: "885",
  variantId: "v1",
  productId: "p 1",
  productRef: "TY-VIGO-08",
  name: "วาล์ว",
};
const detail = {
  product: { imageKey: "img/valve.jpg" },
  onHand: 3,
  held: 1,
  pricing: { targetPriceSatang: 65000, itemCostSatang: 44000 },
};

describe("lookupPart", () => {
  it("given a known code > then it returns the part with its stock and price, asked with the session", async () => {
    const { calls, fetchFn } = recording([
      async () => Response.json(found),
      async () => Response.json(detail),
    ]);

    const part = await lookupPart(fetchFn, "http://api", "tok", "88 5/1");

    expect(part).toEqual({
      variantId: "v1",
      productId: "p 1",
      productRef: "TY-VIGO-08",
      name: "วาล์ว",
      imageKey: "img/valve.jpg",
      onHand: 3,
      held: 1,
      unitPriceSatang: 65000,
      unitCostSatang: 44000,
      qty: 1,
    });
    expect(calls.map((c) => c.url)).toEqual([
      "http://api/products/by-barcode/88%205%2F1",
      "http://api/products/p%201",
    ]);
    expect(calls[0]?.init.headers).toEqual({ "X-Staff-Session": "tok" });
  });

  it("given a code no product has > then it is null and nothing else is asked", async () => {
    const { calls, fetchFn } = recording([async () => new Response("", { status: 404 })]);

    expect(await lookupPart(fetchFn, "http://api", "tok", "nope")).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("given a product with no price yet > then its price counts as zero", async () => {
    const { fetchFn } = recording([
      async () => Response.json(found),
      async () => Response.json({ ...detail, pricing: null }),
    ]);

    const part = await lookupPart(fetchFn, "http://api", "tok", "885");

    expect(part?.unitPriceSatang).toBe(0);
    expect(part?.unitCostSatang).toBe(0);
  });

  it("given the shop's system fails > then it says so instead of pretending the part is unknown", async () => {
    const { fetchFn } = recording([async () => new Response("", { status: 500 })]);

    await expect(lookupPart(fetchFn, "http://api", "tok", "885")).rejects.toThrow("HTTP 500");
  });
});

describe("moveHold", () => {
  it("given a batch > then it sends every line at once and returns each line's result", async () => {
    const results = [{ variantId: "v1", applied: true, sellableAfter: 2, heldAfter: 2 }];
    const { calls, fetchFn } = recording([async () => Response.json({ results })]);
    const lines = [{ productVariantId: "v1", takeAway: 1, bringBack: 0 }];

    expect(await moveHold(fetchFn, "http://api", "tok", lines)).toEqual(results);
    expect(calls[0]?.url).toBe("http://api/stock/hold");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ lines });
  });

  it("given the shop's system refuses the batch > then its own words come back as the error", async () => {
    const { fetchFn } = recording([
      async () => Response.json({ error: "no lines" }, { status: 400 }),
    ]);

    await expect(moveHold(fetchFn, "http://api", "tok", [])).rejects.toThrow("no lines");
  });
});

describe("receiveStock", () => {
  it("given an amount > then it records a 'receive' movement for that part", async () => {
    const { calls, fetchFn } = recording([
      async () => Response.json({ applied: true, quantityAfter: 6 }),
    ]);

    expect(await receiveStock(fetchFn, "http://api", "tok", "v1", 3)).toEqual({
      applied: true,
      quantityAfter: 6,
    });
    expect(calls[0]?.url).toBe("http://api/stock/adjust");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      productVariantId: "v1",
      quantityDelta: 3,
      movementType: "receive",
      reason: "received via Scan",
    });
  });
});

describe("parkBill", () => {
  it("given bill lines > then it parks them as a parts draft that ทำบิล can open", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({ ok: true })]);
    const lines = [
      {
        productVariantId: "v1",
        lineType: "part" as const,
        description: "วาล์ว",
        barcodeValue: "TY-VIGO-08",
        quantity: 2,
        unitPriceSatang: 65000,
        unitCostSatang: 44000,
      },
    ];

    await parkBill(fetchFn, "http://api", "tok", "d-1", lines);

    expect(calls[0]?.url).toBe("http://api/onsite/drafts");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      draftId: "d-1",
      stage: "draft",
      saleType: "parts",
      lines,
    });
  });

  it("given the draft is not saved > then it fails loudly, so no one is sent to an empty bill", async () => {
    const { fetchFn } = recording([async () => new Response("", { status: 503 })]);

    await expect(parkBill(fetchFn, "http://api", "tok", "d-1", [])).rejects.toThrow("HTTP 503");
  });
});
