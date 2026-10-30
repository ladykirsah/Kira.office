import type { Phrase } from "@l-shopee/shared/lang";
import type { PayAccount } from "./scanApi";
import {
  buildSale,
  nextSaleNumber,
  saleLines,
  saleRefusal,
  saleSaved,
  saleTotal,
  type SaleRecord,
  type SyncResult,
} from "./scanSale";
import type { ScanCard } from "./scanTabs";

export interface BillDeps {
  saleNumbers: () => Promise<(string | null)[]>;
  sendSale: (sale: SaleRecord) => Promise<SyncResult>;
  recordPayment: (payment: {
    methodLabel: string;
    promptpayId: string;
    amountSatang: number;
    /** The bill it paid for, shown on its row on the Payment page. */
    saleNumber: string;
  }) => Promise<void>;
  now: () => number;
}

/** One sale being paid for; kept across retries — and reopening the sheet — so it saves once. */
export interface Attempt {
  clientUuid: string;
  saleNumber: string | null;
  at: number | null;
}

export interface BillDoc {
  shopName: string;
  saleNumber: string;
  at: number;
  lines: { name: string; qty: number; unitSatang: number; totalSatang: number }[];
  totalSatang: number;
  paidBy: "cash" | "promptpay";
}

export type BillOutcome =
  | { ok: true; bill: BillDoc; attempt: Attempt; warning: Phrase | null }
  | { ok: false; why: Phrase; attempt: Attempt };

export function newAttempt(clientUuid: string): Attempt {
  return { clientUuid, saleNumber: null, at: null };
}

const NO_ACCOUNT: Phrase = {
  th: "ยังไม่ได้ตั้งบัญชีพร้อมเพย์ของร้าน ตั้งได้ที่หน้าข้อมูลร้าน",
  en: "The shop has no PromptPay account yet. Set one on the Shop page.",
};

const PAYMENT_NOT_LISTED: Phrase = {
  th: "ออกบิลแล้ว แต่บันทึกรายการรับเงินพร้อมเพย์ไม่สำเร็จ ตรวจที่หน้าการชำระเงิน",
  en: "The bill is issued, but the PromptPay payment did not reach the payment list. Check the Payments page.",
};

function trouble(err: unknown): Phrase {
  if (err instanceof TypeError) {
    return {
      th: "เชื่อมต่อระบบร้านไม่ได้ ตรวจอินเทอร์เน็ตแล้วกดออกบิลอีกครั้ง",
      en: "Could not reach the shop's system. Check the internet and tap Issue bill again.",
    };
  }
  const why = err instanceof Error ? err.message : String(err);
  return {
    th: `บันทึกบิลไม่สำเร็จ (${why}) กดออกบิลอีกครั้ง`,
    en: `The bill was not saved (${why}). Tap Issue bill again.`,
  };
}

/**
 * A mechanic pays at the counter (ช่าง → เงินสด or พร้อมเพย์ → ออกบิล): the sale goes into the sales
 * ledger at the mechanic price, exactly as ทำบิล records one, and then a PromptPay payment goes on
 * the shop's payment list. The sale comes first so a refused sale never leaves a payment listed.
 * Safe to tap again after any failure:
 * - the sale keeps one clientUuid, so the server saves it at most once;
 * - the payment is listed only after the sale saved, so a retry never lists it twice;
 * - the bill number is kept after a dropped connection (the sale may have landed under it) and
 *   taken afresh only when the system refused, when nothing was saved and another device may have
 *   issued that number meanwhile.
 */
export async function issueMechanicBill(
  deps: BillDeps,
  attempt: Attempt,
  input: {
    cards: readonly ScanCard[];
    pay: "cash" | "promptpay";
    account: PayAccount | null;
    shopName: string;
    lastIssued: string | null;
  },
): Promise<BillOutcome> {
  if (input.pay === "promptpay" && !input.account) {
    return { ok: false, why: NO_ACCOUNT, attempt };
  }
  const lines = saleLines(input.cards, "mechanic");
  const totalSatang = saleTotal(input.cards, "mechanic");
  let current = attempt;
  try {
    if (current.saleNumber === null || current.at === null) {
      const at = deps.now();
      const known = [...(await deps.saleNumbers()), input.lastIssued];
      current = { ...current, saleNumber: nextSaleNumber(known, at), at };
    }
    const saleNumber = current.saleNumber as string;
    const result = await deps.sendSale(
      buildSale({ clientUuid: current.clientUuid, saleNumber, paymentMethod: input.pay, lines }),
    );
    if (!saleSaved(result)) {
      return {
        ok: false,
        why: saleRefusal(result),
        attempt: { ...current, saleNumber: null, at: null },
      };
    }
    const warning =
      input.account && input.pay === "promptpay"
        ? await listPayment(deps, input.account, totalSatang, saleNumber)
        : null;
    return {
      ok: true,
      attempt: current,
      warning,
      bill: {
        shopName: input.shopName,
        saleNumber,
        at: current.at as number,
        lines: lines.map((l) => ({
          name: l.description,
          qty: l.quantity,
          unitSatang: l.unitPriceSatang,
          totalSatang: l.unitPriceSatang * l.quantity,
        })),
        totalSatang,
        paidBy: input.pay,
      },
    };
  } catch (err) {
    const dropped = err instanceof TypeError;
    return {
      ok: false,
      why: trouble(err),
      attempt: dropped ? current : { ...current, saleNumber: null, at: null },
    };
  }
}

/** Puts the PromptPay payment on the payment list; a failure is a warning, the sale stands. */
async function listPayment(
  deps: BillDeps,
  account: PayAccount,
  amountSatang: number,
  saleNumber: string,
): Promise<Phrase | null> {
  try {
    await deps.recordPayment({
      methodLabel: account.label,
      promptpayId: account.promptpayId,
      amountSatang,
      saleNumber,
    });
    return null;
  } catch {
    return PAYMENT_NOT_LISTED;
  }
}

/**
 * Whether a try that lost its answer (a dropped connection) did save after all: its bill number is
 * among the shop's bills. Asked before a changed sale starts afresh, so it is never sold twice.
 */
export function savedEarlier(attempt: Attempt, issued: readonly (string | null)[]): boolean {
  return attempt.saleNumber !== null && issued.includes(attempt.saleNumber);
}
