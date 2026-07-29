import { apiFetch } from "./apiFetch";
import {
  formatSyncFailureMessage,
  isSyncSuccess,
  type QueuedSale,
  type SyncResponse,
} from "./outbox";

/**
 * Send one completed sale to the server. Shared by the counter and the payment step so a sale is
 * transmitted the same way whoever takes the money; the caller decides what to do when it fails
 * (POS and the payment page both fall back to the offline outbox).
 */
export async function syncSale(sale: QueuedSale): Promise<{ ok: boolean; message?: string }> {
  const res = await apiFetch("/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sales: [sale] }),
  });
  if (!res.ok) return { ok: false, message: `Server error (HTTP ${res.status})` };
  const body = (await res.json()) as SyncResponse;
  if (!isSyncSuccess(body)) return { ok: false, message: formatSyncFailureMessage(body) };
  return { ok: true };
}
