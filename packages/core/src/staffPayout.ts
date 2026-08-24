/**
 * Money leaving the shop for a person — an advance before payday, or the wage itself.
 *
 * ONE RULE FOR BOTH (owner, 2026-08-24): paying **cash** needs nothing beyond the amount, paying by
 * **transfer** requires the slip. Before this, marking a wage paid demanded a slip unconditionally,
 * which is wrong for a shop that mostly hands over cash: it pushed people into either not recording
 * the payment at all or attaching something meaningless to get past the form. A rule people route
 * around is not a control.
 */

export type PayMethod = "cash" | "transfer";

export function isPayMethod(v: unknown): v is PayMethod {
  return v === "cash" || v === "transfer";
}

/** Transfers leave a record elsewhere; the slip is how this system gets to see it. */
export function slipRequired(method: PayMethod): boolean {
  return method === "transfer";
}

/**
 * What is wrong with this payout, in the words the screen should use — or null when nothing is.
 *
 * Returns a message rather than a boolean so the caller cannot invent its own wording: the same
 * sentence has to come back whether it was the advance form or the wage form that was short.
 *
 * Cash WITH a slip is allowed on purpose. Someone photographing a cash handover is being careful,
 * not making a mistake, and refusing it would teach them the form is fussy rather than useful.
 */
export function payoutProblem(p: { method: unknown; slipKey: string | null }): string | null {
  if (!isPayMethod(p.method)) return "method must be cash or transfer";
  // Trimmed: an empty or whitespace key is not proof of anything, and a form that submits " " is
  // the normal way that happens.
  if (slipRequired(p.method) && !(p.slipKey ?? "").trim()) {
    return "a transfer needs its slip attached";
  }
  return null;
}

/**
 * What is still due on payday once advances are taken off, and what is over.
 *
 * Over-advancing is ALLOWED (owner, 2026-08-24): the month simply pays ฿0 and the excess comes back
 * as `owedSatang` for the owner to settle by hand. Deliberately NO automatic carry into next month —
 * a debt that follows someone across months on its own is how a wage quietly becomes a number
 * nobody on either side can explain.
 *
 * Both sides are floored at zero, so neither a wage nor a debt can ever be reported as negative.
 */
export function settleMonth(p: { earnedSatang: number; advanceSatang: number }): {
  dueSatang: number;
  owedSatang: number;
} {
  const diff = p.earnedSatang - p.advanceSatang;
  return { dueSatang: Math.max(0, diff), owedSatang: Math.max(0, -diff) };
}
