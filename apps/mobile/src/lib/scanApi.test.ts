import { describe, expect, it } from "vitest";
import {
  adjustStock,
  lookupPart,
  moveHold,
  parkBill,
  readShop,
  recordPayment,
  sendSale,
  todaysSaleNumbers,
} from "./scanApi";
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
  product: { imageKey: "img/valve.jpg", brandName: "Sanden" },
  onHand: 3,
  held: 1,
  pricing: { targetPriceSatang: 65000, b2bPriceSatang: 58000, itemCostSatang: 44000 },
  images: [{ imageKey: "img/valve.jpg" }, { imageKey: "img/valve-side.jpg" }],
};

describe("lookupPart", () => {
  it("given a known code > then it returns the part with its photos, stock and both prices, asked with the session", async () => {
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
      brandName: "Sanden",
      barcode: "885",
      photoKeys: ["img/valve.jpg", "img/valve-side.jpg"],
      onHand: 3,
      held: 1,
      unitPriceSatang: 65000,
      b2bPriceSatang: 58000,
      unitCostSatang: 44000,
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
    expect(part?.b2bPriceSatang).toBe(0);
    expect(part?.unitCostSatang).toBe(0);
  });

  it("given no gallery > then the product's own photo is shown; given none at all > then no photos", async () => {
    const noGallery = recording([
      async () => Response.json(found),
      async () => Response.json({ ...detail, images: [] }),
    ]);
    const bare = recording([
      async () => Response.json(found),
      async () => Response.json({ ...detail, product: { imageKey: null }, images: [] }),
    ]);

    expect((await lookupPart(noGallery.fetchFn, "http://api", "tok", "885"))?.photoKeys).toEqual([
      "img/valve.jpg",
    ]);
    expect((await lookupPart(bare.fetchFn, "http://api", "tok", "885"))?.photoKeys).toEqual([]);
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

describe("adjustStock", () => {
  it("given a stock move > then it records it for that part and returns whether it applied", async () => {
    const { calls, fetchFn } = recording([
      async () => Response.json({ applied: true, quantityAfter: 6 }),
    ]);
    const move = {
      productVariantId: "v1",
      countedOnHand: 6,
      movementType: "correction" as const,
      reason: "recounted via Scan",
    };

    expect(await adjustStock(fetchFn, "http://api", "tok", move)).toEqual({ applied: true });
    expect(calls[0]?.url).toBe("http://api/stock/adjust");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(move);
  });

  it("given the move is refused > then the system's reason comes back with it", async () => {
    const { fetchFn } = recording([
      async () => Response.json({ applied: false, reason: "would go below zero" }),
    ]);
    const move = {
      productVariantId: "v1",
      quantityDelta: -9,
      movementType: "write_off" as const,
      reason: "damaged or lost via Scan",
    };

    expect(await adjustStock(fetchFn, "http://api", "tok", move)).toEqual({
      applied: false,
      reason: "would go below zero",
    });
  });
});

describe("todaysSaleNumbers", () => {
  it("returns every bill number the shop has issued, for the next number to follow", async () => {
    const { calls, fetchFn } = recording([
      async () =>
        Response.json({ sales: [{ saleNumber: "DAS202610-26002" }, { saleNumber: null }] }),
    ]);

    expect(await todaysSaleNumbers(fetchFn, "http://api", "tok")).toEqual([
      "DAS202610-26002",
      null,
    ]);
    expect(calls[0]?.url).toBe("http://api/sales");
  });
});

describe("sendSale", () => {
  const sale = {
    clientUuid: "u-1",
    saleNumber: "DAS202610-26003",
    paymentMethod: "cash" as const,
    saleType: "parts" as const,
    lines: [],
  };

  it("sends the one sale to the sales ledger and returns the system's answer", async () => {
    const answer = { applied: 1, duplicates: 0, conflicts: [], validationErrors: [] };
    const { calls, fetchFn } = recording([async () => Response.json(answer)]);

    expect(await sendSale(fetchFn, "http://api", "tok", sale)).toEqual(answer);
    expect(calls[0]?.url).toBe("http://api/sync");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ sales: [sale] });
  });

  it("given the system fails > then it throws, so the bill is not shown as paid", async () => {
    const { fetchFn } = recording([async () => new Response("", { status: 500 })]);

    await expect(sendSale(fetchFn, "http://api", "tok", sale)).rejects.toThrow("HTTP 500");
  });
});

describe("recordPayment", () => {
  it("records the PromptPay payment on the shop's payment list", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({ payment: { id: "pay-1" } })]);
    const payment = {
      methodLabel: "ร้าน",
      promptpayId: "0812345678",
      amountSatang: 426000,
      saleNumber: "DAS202610-30001",
    };

    await recordPayment(fetchFn, "http://api", "tok", payment);

    expect(calls[0]?.url).toBe("http://api/payments");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(payment);
  });

  it("given it is not recorded > then it throws", async () => {
    const { fetchFn } = recording([async () => new Response("", { status: 400 })]);

    await expect(
      recordPayment(fetchFn, "http://api", "tok", {
        methodLabel: "ร้าน",
        promptpayId: "0812345678",
        amountSatang: 1,
      }),
    ).rejects.toThrow("HTTP 400");
  });
});

describe("readShop", () => {
  it("reads Den Air Service's name and its default PromptPay account", async () => {
    const methods = [
      { id: "a", label: "แม่", promptpayId: "0811111111" },
      { id: "b", label: "ร้าน", promptpayId: "0822222222", isDefault: true },
    ];
    const { calls, fetchFn } = recording([
      async () =>
        Response.json({ name: "Den Air Service", paymentMethods: JSON.stringify(methods) }),
    ]);

    expect(await readShop(fetchFn, "http://api", "tok")).toEqual({
      name: "Den Air Service",
      account: { label: "ร้าน", promptpayId: "0822222222", accountName: null },
    });
    expect(calls[0]?.url).toBe("http://api/shop-info/denair");
  });

  it("given the account's bank name > then the QR can show it (owner rule, 30 Oct 2026)", async () => {
    const methods = [
      {
        id: "b",
        label: "ร้าน",
        promptpayId: "0822222222",
        accountName: " เด่น แอร์ ",
        isDefault: true,
      },
    ];
    const { fetchFn } = recording([
      async () => Response.json({ name: "Den", paymentMethods: JSON.stringify(methods) }),
    ]);

    expect((await readShop(fetchFn, "http://api", "tok")).account?.accountName).toBe("เด่น แอร์");
  });

  it("given no PromptPay account set up > then there is no account to show", async () => {
    const { fetchFn } = recording([async () => Response.json({ name: "", paymentMethods: "" })]);

    expect(await readShop(fetchFn, "http://api", "tok")).toEqual({ name: "", account: null });
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
