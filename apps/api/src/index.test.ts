import { describe, it, expect } from "vitest";
import worker from "./index";

const env = {} as never;
const ctx = {} as ExecutionContext;

describe("api worker", () => {
  it("GET /health > 200 ok", async () => {
    const res = await worker.fetch!(new Request("https://x/health"), env, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "kiraoffice-api" });
  });

  it("POST /pricing/preview > computes profit via core", async () => {
    const res = await worker.fetch!(
      new Request("https://x/pricing/preview", {
        method: "POST",
        body: JSON.stringify({
          unitPrice: 107,
          quantity: 1,
          vatRate: 0.07,
          priceIncludesVat: true,
          landedUnitCost: 60,
          channel: "onsite",
        }),
      }),
      env,
      ctx,
    );
    const body = (await res.json()) as { grossProfit: number; salesExTax: number };
    expect(body.grossProfit).toBe(40);
    expect(body.salesExTax).toBe(100);
  });

  it("unknown route > 404", async () => {
    const res = await worker.fetch!(new Request("https://x/nope"), env, ctx);
    expect(res.status).toBe(404);
  });
});
