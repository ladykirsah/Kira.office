/**
 * ค่าคอม Shopee — what Shopee takes off every sale there, for the whole business (owner, 5 Nov 2026:
 * "i want A, but on the main page is total %, and the pop up shown all amount we have been charged").
 * One set of fees, kept as one KV value (the shop's settings live in KV too); each fee is hundredths
 * of a percent, so 3.21% is 321. ข้อมูลร้าน shows their sum; the product page takes the sum off the
 * Shopee price for its profit. It replaces the per-product `pricing_profiles.online_commission_bp`
 * the old back office set, which the app no longer reads.
 */
export interface ShopeeFees {
  /** ค่าคอมมิชชั่น. */
  commissionBp: number;
  /** ค่าธรรมเนียมธุรกรรม. */
  transactionBp: number;
  /** ค่าบริการโปรแกรม. */
  serviceBp: number;
}

export const SHOPEE_FEES_KEY = "shopee:fees";

export const NO_FEES: ShopeeFees = { commissionBp: 0, transactionBp: 0, serviceBp: 0 };

const FEE_KEYS = ["commissionBp", "transactionBp", "serviceBp"] as const;

/** 100% in hundredths of a percent: Shopee can't take more than the whole price. */
const WHOLE = 10_000;

const isFee = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

/** The saved fees; nothing saved, or a value that isn't three fees, reads as 0s. */
export function readShopeeFees(raw: string | null): ShopeeFees {
  if (!raw) return NO_FEES;
  try {
    const out = checkShopeeFees(JSON.parse(raw));
    return typeof out === "string" ? NO_FEES : out;
  } catch {
    return NO_FEES;
  }
}

/** The fees a save sends, or why they are refused. Every fee must be sent: a missing one is not 0. */
export function checkShopeeFees(body: unknown): ShopeeFees | string {
  if (!body || typeof body !== "object") return "send commissionBp, transactionBp and serviceBp";
  const b = body as Record<string, unknown>;
  for (const k of FEE_KEYS) {
    if (!isFee(b[k])) return `${k} must be a whole number of hundredths of a percent, 0 or more`;
  }
  const fees: ShopeeFees = {
    commissionBp: b.commissionBp as number,
    transactionBp: b.transactionBp as number,
    serviceBp: b.serviceBp as number,
  };
  if (fees.commissionBp + fees.transactionBp + fees.serviceBp > WHOLE)
    return "the fees add up to more than 100%";
  return fees;
}
