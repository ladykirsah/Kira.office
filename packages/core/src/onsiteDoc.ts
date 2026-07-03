/**
 * On-site document lifecycle. An `onsite_sales` row moves through stages:
 *   draft     — editable work-in-progress; not revenue, no stock, no number yet
 *   quotation — a saved estimate (QT… number); not revenue, no stock; still editable; can convert
 *   bill      — a finalized cash bill (DAS… number); posts to the ledger + deducts stock; terminal
 *
 * Pure rules only — the API/DB enforce them; the POS UI reads them to decide what's allowed.
 */
export const DOC_STAGES = ["draft", "quotation", "bill"] as const;
export type DocStage = (typeof DOC_STAGES)[number];

export function isDocStage(value: string): value is DocStage {
  return (DOC_STAGES as readonly string[]).includes(value);
}

/** Legal forward transitions: draft→quotation, draft→bill, quotation→bill. A bill is terminal. */
export function canConvert(from: DocStage, to: DocStage): boolean {
  if (from === "draft") return to === "quotation" || to === "bill";
  if (from === "quotation") return to === "bill";
  return false; // bill is terminal
}

/** A draft or quotation can still have its lines edited; a finalized bill is locked. */
export function isEditable(stage: DocStage): boolean {
  return stage !== "bill";
}

/** Only a completed bill is revenue — never a draft, a quotation, or a refunded bill. */
export function countsAsRevenue(stage: DocStage, saleStatus: string): boolean {
  return stage === "bill" && saleStatus === "completed";
}

/** Stock is deducted only when a document becomes a bill (at finalize). */
export function deductsStock(stage: DocStage): boolean {
  return stage === "bill";
}

/** The sales-number prefix each numbered stage uses; a draft has no number yet (null). */
export function numberPrefixFor(stage: DocStage): string | null {
  if (stage === "quotation") return "QT";
  if (stage === "bill") return "DAS";
  return null; // draft
}
