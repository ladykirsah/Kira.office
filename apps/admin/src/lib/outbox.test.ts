import { describe, it, expect } from "vitest";
import {
  flushOutbox,
  createMemoryStore,
  isSyncSuccess,
  formatSyncFailureMessage,
  type QueuedSale,
} from "./outbox";

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

describe("isSyncSuccess", () => {
  it("given applied=1 with no conflicts > succeeds", () => {
    expect(isSyncSuccess({ applied: 1, duplicates: 0, conflicts: [], validationErrors: [] })).toBe(
      true,
    );
  });

  it("given duplicates=1 (idempotent retry) > succeeds", () => {
    expect(isSyncSuccess({ applied: 0, duplicates: 1, conflicts: [], validationErrors: [] })).toBe(
      true,
    );
  });

  it("given conflicts > fails", () => {
    expect(
      isSyncSuccess({
        applied: 0,
        duplicates: 0,
        conflicts: [{ productVariantId: "v1", requested: 5, available: 1 }],
        validationErrors: [],
      }),
    ).toBe(false);
  });

  it("given validationErrors > fails", () => {
    expect(
      isSyncSuccess({
        applied: 0,
        duplicates: 0,
        conflicts: [],
        validationErrors: [{ clientUuid: "x", reason: "bad line" }],
      }),
    ).toBe(false);
  });
});

describe("formatSyncFailureMessage", () => {
  it("describes stock conflicts in plain language", () => {
    expect(
      formatSyncFailureMessage({
        applied: 0,
        duplicates: 0,
        conflicts: [{ productVariantId: "v1", requested: 5, available: 1 }],
        validationErrors: [],
      }),
    ).toMatch(/Not enough stock/);
  });

  it("surfaces validation errors first", () => {
    expect(
      formatSyncFailureMessage({
        applied: 0,
        duplicates: 0,
        conflicts: [],
        validationErrors: [{ clientUuid: "x", reason: "quantity must be a positive integer" }],
      }),
    ).toBe("quantity must be a positive integer");
  });
});
