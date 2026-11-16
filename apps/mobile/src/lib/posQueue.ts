import type { BillSale, CustomerUpsert } from "./posBill";
import { saleRefusal, type SyncResult } from "./scanSale";

/**
 * Bills issued with no internet (ทำบิล 6, owner approved 30 Oct 2026). The customer already has the
 * bill, so it waits on this device and goes to the server when the internet is back. The server
 * keys each sale on its clientUuid, so sending one twice never counts it twice; one the server
 * refuses (its stock count is off) stays here with the reason until staff fix the stock and resend.
 */
export interface QueuedBill {
  sale: BillSale;
  issuedAt: number;
  totalSatang: number;
  /** The plate, or the mechanic's name — what the waiting list shows. */
  label: string;
  status: "waiting" | "refused";
  reason: string | null;
  /** What a sent bill still has to do once it is in: the car's record, the draft, the payment. */
  after?: {
    customer: CustomerUpsert | null;
    draftId: string | null;
    /** Missing on bills queued before 16 Nov 2026. */
    payment?: BillPayment | null;
  };
}

/** What goes on การชำระเงิน for a PromptPay bill. */
export interface BillPayment {
  methodLabel: string;
  promptpayId: string;
  amountSatang: number;
  saleNumber: string;
}

/**
 * The การชำระเงิน record a PromptPay bill makes, whether it is sent at once or waits on the phone
 * (bug hunt 15 Nov 2026: a bill issued offline never reached การชำระเงิน). None for cash.
 */
export function billPayment(
  payMethod: string,
  account: { label: string; promptpayId: string } | null,
  totalSatang: number,
  saleNumber: string,
): BillPayment | null {
  if (payMethod !== "promptpay" || !account) return null;
  return {
    methodLabel: account.label,
    promptpayId: account.promptpayId,
    amountSatang: totalSatang,
    saleNumber,
  };
}

export type SendOutcome =
  { kind: "saved" } | { kind: "refused"; reason: string } | { kind: "offline" };

export function queueAdd(q: readonly QueuedBill[], bill: QueuedBill): QueuedBill[] {
  return [...q.filter((b) => b.sale.clientUuid !== bill.sale.clientUuid), bill];
}

/**
 * The queue after one send. When nothing changed it is the SAME array, not a copy: the page saves
 * and resends whenever the queue changes, so a fresh copy of an unchanged queue resent the bills
 * nonstop instead of once a minute (bug hunt 15 Nov 2026).
 */
export function queueAfterSend(
  q: readonly QueuedBill[],
  clientUuid: string,
  outcome: SendOutcome,
): readonly QueuedBill[] {
  if (outcome.kind === "offline") return q;
  if (outcome.kind === "saved") return q.filter((b) => b.sale.clientUuid !== clientUuid);
  const bill = q.find((b) => b.sale.clientUuid === clientUuid);
  if (!bill || (bill.status === "refused" && bill.reason === outcome.reason)) return q;
  return q.map((b) => (b === bill ? { ...b, status: "refused", reason: outcome.reason } : b));
}

function isQueuedBill(x: unknown): x is QueuedBill {
  if (typeof x !== "object" || x === null) return false;
  const b = x as Partial<QueuedBill>;
  return (
    typeof b.sale === "object" &&
    b.sale !== null &&
    typeof b.sale.clientUuid === "string" &&
    Array.isArray(b.sale.lines) &&
    typeof b.issuedAt === "number" &&
    (b.status === "waiting" || b.status === "refused")
  );
}

/** The queue as saved on the device. Broken text reads as empty rather than stopping the page. */
export function parseQueue(raw: string | null): QueuedBill[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isQueuedBill) : [];
  } catch {
    return [];
  }
}

export function queueSummary(q: readonly QueuedBill[]): { count: number; refused: number } {
  return { count: q.length, refused: q.filter((b) => b.status === "refused").length };
}

/** fetch() rejects with a TypeError when there is no connection; the server's refusals are Errors. */
export const isNetworkError = (e: unknown): boolean => e instanceof TypeError;

/**
 * Why the server would not take a waiting bill, in the drawing's words: which part, what the system
 * has, what was sold. The bill is already with the customer, so the fix is the stock count.
 */
export function queueRefusal(sale: BillSale, result: SyncResult): string {
  const clash = result.conflicts[0];
  if (clash) {
    const line = sale.lines.find((l) => l.productVariantId === clash.productVariantId);
    return `${line?.description ?? "สินค้า"} · ในระบบเหลือ ${clash.available} ขายไป ${clash.requested}`;
  }
  return saleRefusal(result).th;
}
