import type { OpenDraft } from "./api";

/**
 * Build the customer-enrichment upsert to fire after a POS checkout, so the plate's province (typed
 * at POS) lands on the plate-keyed customer record. Returns null when there's nothing worth saving —
 * no plate to key on, or no province entered — so we don't create an empty enrichment row.
 */
export function buildCheckoutCustomerUpsert(input: {
  plate: string;
  province: string;
}): { licensePlate: string; plateProvince: string } | null {
  const licensePlate = input.plate.trim();
  const plateProvince = input.province.trim();
  if (!licensePlate || !plateProvince) return null;
  return { licensePlate, plateProvince };
}

/**
 * Reconcile the open-drafts panel after a checkout finalizes a reopened parked draft/quotation.
 * The finalized draft has been converted into a real bill, so it must disappear from the tray —
 * otherwise staff can reopen the ghost (reopenDraft rebuilds the cart from the in-memory copy, no
 * re-fetch) and check out a second time: a duplicate on-site sale (double revenue + double stock
 * deduction). Keeps the server delete and the local-state filter together so they can't drift apart
 * (the drift that caused the original bug). No-op for a walk-in sale (no active draft).
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
