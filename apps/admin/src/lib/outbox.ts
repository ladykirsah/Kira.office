// Offline-first POS outbox. Sales are queued locally and flushed to /sync when online; the server
// dedupes on clientUuid so retries are safe. Storage is abstracted behind OutboxStore so the flush
// logic is pure + unit-testable (IndexedDB adapter lives in outbox-idb.ts, browser-only).

/** Result shape returned by POST /sync. */
export interface SyncResponse {
  applied: number;
  duplicates: number;
  conflicts: { productVariantId: string; requested: number; available: number }[];
  validationErrors: { clientUuid: string; reason: string }[];
}

/** True when a sale was applied or was already synced, with no conflicts or validation errors. */
export function isSyncSuccess(body: SyncResponse): boolean {
  if ((body.conflicts?.length ?? 0) > 0) return false;
  if ((body.validationErrors?.length ?? 0) > 0) return false;
  return (body.applied ?? 0) > 0 || (body.duplicates ?? 0) > 0;
}

/** Human-readable reason when POST /sync did not fully apply the sale. */
export function formatSyncFailureMessage(body: SyncResponse): string {
  if (body.validationErrors?.length) {
    return body.validationErrors.map((e) => e.reason).join("; ");
  }
  if (body.conflicts?.length) {
    return body.conflicts
      .map(
        (c) =>
          `Not enough stock for a line (${c.available} on hand, ${c.requested} requested) — adjust quantities or restock`,
      )
      .join("; ");
  }
  return "Server rejected the sale — check the items and try again.";
}

export interface QueuedLine {
  productVariantId?: string | null; // null for service/labour lines
  lineType?: "part" | "service";
  description?: string; // item name (printed on the bill, stored on the line)
  barcodeValue?: string;
  quantity: number;
  unitPriceSatang: number;
  unitCostSatang?: number; // product cost (for gross-profit on the server)
  discountSatang?: number; // this line's share of the bill discount
  taxSatang?: number; // VAT portion (satang); server fills in when omitted
}

export interface QueuedSale {
  clientUuid: string;
  saleNumber?: string;
  paymentMethod: string;
  saleType?: "parts" | "repair";
  licensePlate?: string;
  vehicle?: string;
  notes?: string;
  lines: QueuedLine[];
  queuedAt: number;
}

export interface OutboxStore {
  add(sale: QueuedSale): Promise<void>;
  all(): Promise<QueuedSale[]>;
  remove(clientUuid: string): Promise<void>;
}

export interface FlushResult {
  synced: number;
  failed: number;
  /** Distinct failure reasons (HTTP status, stock conflict, network error) for the user-facing toast. */
  reasons: string[];
}

/**
 * Try to sync every queued sale. `sync` returns true / {ok:true} on success (sale removed from the
 * queue) or false / {ok:false, message} / throws on failure (sale kept for the next flush). Failure
 * reasons are collected (deduped) so the UI can say WHY — a 401, a stock conflict, and a network
 * error are very different problems. Idempotent: re-flushing already-synced sales is harmless
 * because the server dedupes on clientUuid.
 */
export async function flushOutbox(
  store: OutboxStore,
  sync: (sale: QueuedSale) => Promise<boolean | { ok: boolean; message?: string }>,
): Promise<FlushResult> {
  const pending = await store.all();
  let synced = 0;
  let failed = 0;
  const reasons = new Set<string>();
  for (const sale of pending) {
    try {
      const result = await sync(sale);
      const ok = typeof result === "boolean" ? result : result.ok;
      if (ok) {
        await store.remove(sale.clientUuid);
        synced += 1;
      } else {
        failed += 1;
        const message = typeof result === "boolean" ? undefined : result.message;
        if (message) reasons.add(message);
      }
    } catch (err) {
      failed += 1;
      const message = (err as Error)?.message;
      if (message) reasons.add(message);
    }
  }
  return { synced, failed, reasons: [...reasons] };
}

/** In-memory OutboxStore — used as a fallback when IndexedDB is unavailable, and in tests. */
export function createMemoryStore(initial: QueuedSale[] = []): OutboxStore {
  let sales = [...initial];
  return {
    async add(sale) {
      sales.push(sale);
    },
    async all() {
      return [...sales];
    },
    async remove(clientUuid) {
      sales = sales.filter((s) => s.clientUuid !== clientUuid);
    },
  };
}
