// Offline-first POS outbox. Sales are queued locally and flushed to /sync when online; the server
// dedupes on clientUuid so retries are safe. Storage is abstracted behind OutboxStore so the flush
// logic is pure + unit-testable (IndexedDB adapter lives in outbox-idb.ts, browser-only).

export interface QueuedLine {
  productVariantId?: string | null; // null for service/labour lines
  lineType?: "part" | "service";
  description?: string; // item name (printed on the bill, stored on the line)
  barcodeValue?: string;
  quantity: number;
  unitPriceSatang: number;
  discountSatang?: number; // this line's share of the bill discount
}

export interface QueuedSale {
  clientUuid: string;
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
}

/**
 * Try to sync every queued sale. `sync` returns true on success (sale removed from the queue) or
 * false / throws on failure (sale kept for the next flush). Idempotent: re-flushing already-synced
 * sales is harmless because the server dedupes on clientUuid.
 */
export async function flushOutbox(
  store: OutboxStore,
  sync: (sale: QueuedSale) => Promise<boolean>,
): Promise<FlushResult> {
  const pending = await store.all();
  let synced = 0;
  let failed = 0;
  for (const sale of pending) {
    try {
      if (await sync(sale)) {
        await store.remove(sale.clientUuid);
        synced += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
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
