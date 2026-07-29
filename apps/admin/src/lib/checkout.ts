import type { OpenDraft } from "./api";
import { joinPhones } from "./phones";
import { nextSalesId } from "./salesId";

/**
 * The quotation number to file an exported bill under. Saving the same bill again — PDF, then PNG,
 * then PDF once more — must land on the one entry in the customer's history, so the number is
 * issued once and then reused; only a bill that has never been exported takes a new one.
 */
export function quoteNumberForExport(
  current: string | null,
  lastQuoteId: string | null,
  now: number,
): string {
  return current ?? nextSalesId(lastQuoteId, now, "QT");
}

export interface CheckoutCustomerUpsert {
  licensePlate: string;
  plateProvince?: string;
  customerName?: string;
  phone?: string;
  carModel?: string;
}

/**
 * Build the customer-enrichment upsert to fire after a POS checkout, so what was typed at the
 * counter — the plate's province, and for a new plate the customer's name, numbers and car — lands
 * on the plate-keyed customer record. The car is saved so the next visit can prefill Vehicle.
 *
 * Only the fields actually filled in are sent (the server upsert is COALESCE-safe, so an absent
 * field never overwrites something already known). Returns null when there's no plate to key on, or
 * when the plate is all there is — we don't create an empty enrichment row.
 */
export function buildCheckoutCustomerUpsert(input: {
  plate: string;
  province: string;
  customerName?: string;
  phones?: string[];
  carModel?: string;
}): CheckoutCustomerUpsert | null {
  const licensePlate = input.plate.trim();
  if (!licensePlate) return null;

  const plateProvince = input.province.trim();
  const customerName = (input.customerName ?? "").trim();
  const phone = joinPhones(input.phones ?? []);
  const carModel = (input.carModel ?? "").trim();
  if (!plateProvince && !customerName && !phone && !carModel) return null;

  return {
    licensePlate,
    ...(plateProvince ? { plateProvince } : {}),
    ...(customerName ? { customerName } : {}),
    ...(phone ? { phone } : {}),
    ...(carModel ? { carModel } : {}),
  };
}

/**
 * Reconcile the open-drafts panel after a checkout finalizes a reopened parked draft/quotation.
 * The finalized draft has been converted into a real bill, so it must disappear from the tray —
 * otherwise staff can reopen the ghost (reopenDraft rebuilds the cart from the in-memory copy, no
 * re-fetch) and check out a second time: a duplicate on-site sale (double revenue + double stock
 * deduction). Keeps the server delete and the local-state filter together so they can't drift apart.
 * No-op for a walk-in sale (no active draft).
 */
export async function finalizeParkedDraft(opts: {
  activeDraftId: string | null;
  deleteDraft: (id: string) => Promise<void>;
  setDrafts: (updater: (drafts: OpenDraft[]) => OpenDraft[]) => void;
  setActiveDraftId: (id: string | null) => void;
}): Promise<void> {
  const finalizedId = opts.activeDraftId;
  if (!finalizedId) return; // walk-in sale — nothing was parked.
  // Best-effort server delete: the sale already succeeded, so a delete hiccup must not throw out of
  // checkout. We still drop the local copy so the tray can't reopen (and re-checkout) the ghost.
  await opts.deleteDraft(finalizedId).catch(() => {});
  opts.setDrafts((drafts) => drafts.filter((d) => d.id !== finalizedId));
  opts.setActiveDraftId(null);
}
