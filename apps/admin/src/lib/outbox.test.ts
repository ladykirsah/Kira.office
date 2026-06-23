import { describe, it, expect } from "vitest";
import { flushOutbox, createMemoryStore, type QueuedSale } from "./outbox";

const sale = (clientUuid: string): QueuedSale => ({
  clientUuid,
  paymentMethod: "cash",
  lines: [{ productVariantId: "v1", barcodeValue: "885", quantity: 1, unitPriceSatang: 10700 }],
  queuedAt: 0,
});

describe("flushOutbox", () => {
  it("syncs all queued sales and empties the store on success", async () => {
    const store = createMemoryStore([sale("a"), sale("b")]);
    const out = await flushOutbox(store, async () => true);
    expect(out).toEqual({ synced: 2, failed: 0 });
    expect(await store.all()).toEqual([]);
  });

  it("keeps sales that fail to sync for the next flush", async () => {
    const store = createMemoryStore([sale("a"), sale("b")]);
    const out = await flushOutbox(store, async (s) => s.clientUuid === "a");
    expect(out).toEqual({ synced: 1, failed: 1 });
    const remaining = await store.all();
    expect(remaining.map((s) => s.clientUuid)).toEqual(["b"]);
  });

  it("treats a thrown error (offline) as a failure and keeps the sale", async () => {
    const store = createMemoryStore([sale("a")]);
    const out = await flushOutbox(store, async () => {
      throw new Error("offline");
    });
    expect(out).toEqual({ synced: 0, failed: 1 });
    expect((await store.all()).length).toBe(1);
  });
});
