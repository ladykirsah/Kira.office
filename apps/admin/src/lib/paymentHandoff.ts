import type { BillLineForSale } from "./saleBuilder";

/**
 * Handing a bill from the counter to the payment step.
 *
 * Deliberately client-side (sessionStorage): POS must keep taking cash when the shop is offline,
 * and a server round-trip to fetch the bill would break exactly that. The bill is also filed on the
 * server as a quotation, so it can still be reopened from another device — this is the fast path,
 * not the only copy.
 */

const KEY = "pos:payment:v1";

export interface BillHandoff {
  /** The parked quotation this bill belongs to, so it can be closed once paid. */
  draftId: string;
  saleNumber: string;
  quotationNumber: string | null;
  plate: string;
  vehicle: string;
  note: string;
  discountSatang: number;
  totalSatang: number;
  lines: BillLineForSale[];
}

/** Just the bits of Storage this needs, so tests can pass a fake. */
export interface HandoffStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function stashHandoff(bill: BillHandoff, store: HandoffStore): void {
  store.setItem(KEY, JSON.stringify(bill));
}

export function readHandoff(store: HandoffStore): BillHandoff | null {
  const raw = store.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BillHandoff;
  } catch {
    // Corrupted or half-written — treat as no bill rather than crashing the payment page.
    return null;
  }
}

/** Clear it the moment the sale is taken, so a refresh can't charge the customer twice. */
export function clearHandoff(store: HandoffStore): void {
  store.removeItem(KEY);
}

/**
 * How the money arrived, handed BACK to the counter. The payment step never completes a sale
 * itself: POS owns that (it advances the bill number, files the customer, closes the parked
 * quotation, prints and clears the cart), and doing it in two places is how double sales and
 * duplicate bill numbers happen. This is just the answer to "how was it paid?".
 */
export interface Settlement {
  draftId: string;
  paymentMethod: "cash" | "promptpay";
  receivedBy?: string;
}

const SETTLED_KEY = "pos:settled:v1";

export function stashSettlement(s: Settlement, store: HandoffStore): void {
  store.setItem(SETTLED_KEY, JSON.stringify(s));
}

export function readSettlement(store: HandoffStore): Settlement | null {
  const raw = store.getItem(SETTLED_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Settlement;
  } catch {
    return null;
  }
}

export function clearSettlement(store: HandoffStore): void {
  store.removeItem(SETTLED_KEY);
}
