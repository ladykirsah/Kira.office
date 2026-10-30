import { describe, expect, it } from "vitest";
import {
  cancelOrder,
  decideCod,
  fetchLabelShop,
  fetchOrderDetail,
  fetchOrders,
  moveClaim,
  privateFile,
  recordClaimRefund,
  recordClaimReturn,
  recordDropOff,
  recordRefund,
  reviewPayment,
  saveNote,
} from "./ordersApi";
import type { FetchFn } from "./signIn";

function recording(replies: Array<() => Promise<Response>>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    const reply = replies[calls.length - 1];
    if (!reply) throw new Error(`unexpected call ${url}`);
    return reply();
  };
  return { calls, fetchFn };
}

const headerOf = (init: RequestInit, name: string) =>
  (init.headers as Record<string, string> | undefined)?.[name];

describe("fetchOrders", () => {
  it("given a signed-in phone > then it lists the orders, asked with the session", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({ orders: [{ id: "o1" }] })]);

    const orders = await fetchOrders(fetchFn, "http://api", "tok");

    expect(orders).toEqual([{ id: "o1" }]);
    expect(calls[0]?.url).toBe("http://api/orders");
    expect(headerOf(calls[0]!.init, "X-Staff-Session")).toBe("tok");
  });

  it("given the API refuses > then the failure is raised, never an empty list", async () => {
    const { fetchFn } = recording([async () => new Response("no", { status: 500 })]);

    await expect(fetchOrders(fetchFn, "http://api", "tok")).rejects.toThrow("HTTP 500");
  });
});

describe("fetchOrderDetail", () => {
  it("given an unknown order > then it is null rather than an error", async () => {
    const { calls, fetchFn } = recording([async () => new Response("", { status: 404 })]);

    expect(await fetchOrderDetail(fetchFn, "http://api", "tok", "a/b")).toBeNull();
    expect(calls[0]?.url).toBe("http://api/orders/a%2Fb");
  });
});

describe("reviewPayment", () => {
  it("given a rejection > then the reason travels with it", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({ ok: true })]);

    await reviewPayment(fetchFn, "http://api", "tok", "o1", "reject", "ยอดไม่ตรง");

    expect(calls[0]?.url).toBe("http://api/orders/o1/review-payment");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      decision: "reject",
      reason: "ยอดไม่ตรง",
    });
  });

  it("given the API says why it refused > then that sentence is the error", async () => {
    const { fetchFn } = recording([
      async () => Response.json({ error: "no slip on this order" }, { status: 409 }),
    ]);

    await expect(reviewPayment(fetchFn, "http://api", "tok", "o1", "confirm")).rejects.toThrow(
      "no slip on this order",
    );
  });
});

describe("decideCod", () => {
  it("given approve or deny > then the payment state the web writes is sent", async () => {
    const { calls, fetchFn } = recording([
      async () => Response.json({}),
      async () => Response.json({}),
    ]);

    await decideCod(fetchFn, "http://api", "tok", "o1", "approve");
    await decideCod(fetchFn, "http://api", "tok", "o1", "deny");

    expect(calls[0]?.init.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ paymentStatus: "cod_confirmed" });
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({ paymentStatus: "cod_denied" });
  });
});

describe("recordDropOff", () => {
  it("given a drop-off > then it also moves the order to in transit, as the web does", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({})]);

    await recordDropOff(fetchFn, "http://api", "tok", "o1", {
      carrier: "Flash Express",
      trackingNo: "TH123",
      shippingRealSatang: 6000,
    });

    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      carrier: "Flash Express",
      trackingNo: "TH123",
      shippingRealSatang: 6000,
      orderStatus: "shipped",
    });
  });
});

describe("recordRefund", () => {
  it("given our transfer slip > then the image itself is the body, with its type", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({})]);
    const slip = new Blob(["png"], { type: "image/png" });

    await recordRefund(fetchFn, "http://api", "tok", "o1", slip);

    expect(calls[0]?.url).toBe("http://api/orders/o1/refund");
    expect(headerOf(calls[0]!.init, "content-type")).toBe("image/png");
    expect(calls[0]?.init.body).toBe(slip);
  });
});

describe("claims", () => {
  it("given a claim decision > then the new state and its details are sent to the claim", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({})]);

    await moveClaim(fetchFn, "http://api", "tok", "c1", "mechanic_rejected", { reason: "ใช้ผิด" });

    expect(calls[0]?.url).toBe("http://api/claims/c1");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      state: "mechanic_rejected",
      reason: "ใช้ผิด",
    });
  });

  it("given a refunded claim > then our slip is posted to the claim", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({})]);

    await recordClaimRefund(fetchFn, "http://api", "tok", "c1", new Blob(["j"], { type: "" }));

    expect(calls[0]?.url).toBe("http://api/claims/c1/refund");
    expect(headerOf(calls[0]!.init, "content-type")).toBe("image/jpeg");
  });

  it("given a rejected claim sent back > then the shipment is recorded on the claim", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({})]);

    await recordClaimReturn(fetchFn, "http://api", "tok", "c1", {
      carrier: "Flash Express",
      trackingNo: "TH9",
      shippingFeeSatang: 4500,
    });

    expect(calls[0]?.url).toBe("http://api/claims/c1/return-shipment");
    expect(calls[0]?.init.method).toBe("POST");
  });
});

describe("cancelOrder", () => {
  it("given a reason and a note > then both go to the order's cancel step", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({ ok: true })]);

    await cancelOrder(fetchFn, "http://api", "tok", "o1", "out_of_stock", "ลูกค้าสั่งซ้ำ");

    expect(calls[0]?.url).toBe("http://api/orders/o1/cancel");
    expect(calls[0]?.init.method).toBe("POST");
    expect(headerOf(calls[0]!.init, "X-Staff-Session")).toBe("tok");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      reason: "out_of_stock",
      note: "ลูกค้าสั่งซ้ำ",
    });
  });

  it("given no note > then none is sent", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({ ok: true })]);

    await cancelOrder(fetchFn, "http://api", "tok", "o1", "customer_request", "  ");

    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      reason: "customer_request",
      note: null,
    });
  });

  it("given the parcel left first > then the API's sentence is the error", async () => {
    const { fetchFn } = recording([
      async () => Response.json({ error: "this order has already been sent" }, { status: 409 }),
    ]);

    await expect(cancelOrder(fetchFn, "http://api", "tok", "o1", "other", null)).rejects.toThrow(
      "this order has already been sent",
    );
  });
});

describe("saveNote", () => {
  it("given a staff note > then it is saved on the order", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({})]);

    await saveNote(fetchFn, "http://api", "tok", "o1", "VIP");

    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ staffNote: "VIP" });
  });
});

describe("privateFile", () => {
  it("given a slip key > then the file comes back as data, asked with the session", async () => {
    const { calls, fetchFn } = recording([async () => new Response("img")]);

    const file = await privateFile(fetchFn, "http://api", "tok", "slip/a b.jpg");

    expect(await file.text()).toBe("img");
    expect(calls[0]?.url).toBe("http://api/file/slip/a%20b.jpg");
    expect(headerOf(calls[0]!.init, "X-Staff-Session")).toBe("tok");
  });

  it("given a viewer who may not see it > then it fails instead of showing nothing", async () => {
    const { fetchFn } = recording([async () => new Response("Forbidden", { status: 403 })]);

    await expect(privateFile(fetchFn, "http://api", "tok", "slip/x.jpg")).rejects.toThrow(
      "HTTP 403",
    );
  });
});

describe("fetchLabelShop", () => {
  it("given a signed-in phone > then AirPlus's own details come back for the label", async () => {
    const { calls, fetchFn } = recording([
      async () =>
        Response.json({
          name: "AirPlus Auto",
          address: "99/1 ถ.งามวงศ์วาน",
          shipFromPhone: "02-123-4567",
          shipFromPostcode: "11000",
          lineUrl: "https://lin.ee/x",
          qrHeadline: "ขอบคุณครับ",
          qrSubtitle: "ทักไลน์ได้เลย",
          paymentMethods: "[]",
        }),
    ]);

    const shop = await fetchLabelShop(fetchFn, "http://api", "tok");

    expect(shop).toEqual({
      name: "AirPlus Auto",
      phone: "02-123-4567",
      address: "99/1 ถ.งามวงศ์วาน",
      postcode: "11000",
      lineUrl: "https://lin.ee/x",
      headline: "ขอบคุณครับ",
      subtitle: "ทักไลน์ได้เลย",
    });
    expect(calls[0]?.url).toBe("http://api/shop-info/airplus");
    expect(headerOf(calls[0]!.init, "X-Staff-Session")).toBe("tok");
  });

  it("given details never saved > then each is empty, so the label falls back to its usual words", async () => {
    const { fetchFn } = recording([async () => Response.json({ name: null })]);

    expect(await fetchLabelShop(fetchFn, "http://api", "tok")).toEqual({
      name: "",
      phone: "",
      address: "",
      postcode: "",
      lineUrl: "",
      headline: "",
      subtitle: "",
    });
  });

  it("given the API refuses > then the failure is raised, never a label with no sender", async () => {
    const { fetchFn } = recording([async () => new Response("no", { status: 500 })]);

    await expect(fetchLabelShop(fetchFn, "http://api", "tok")).rejects.toThrow("HTTP 500");
  });
});
