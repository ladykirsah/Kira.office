// Browser-only IndexedDB implementation of OutboxStore. Imported only from client components, so it
// is never evaluated under Node/SSR. Falls back to an in-memory store when IndexedDB is unavailable.
import { createMemoryStore, type OutboxStore, type QueuedSale } from "./outbox";

const DB_NAME = "kira-pos";
const STORE = "outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "clientUuid" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
) {
  return new Promise<T>((resolve, reject) => {
    const request = fn(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIdbStore(): OutboxStore {
  if (typeof indexedDB === "undefined") return createMemoryStore();
  return {
    async add(sale: QueuedSale) {
      const db = await openDb();
      await tx(db, "readwrite", (s) => s.put(sale));
    },
    async all() {
      const db = await openDb();
      return tx<QueuedSale[]>(db, "readonly", (s) => s.getAll() as IDBRequest<QueuedSale[]>);
    },
    async remove(clientUuid: string) {
      const db = await openDb();
      await tx(db, "readwrite", (s) => s.delete(clientUuid));
    },
  };
}
