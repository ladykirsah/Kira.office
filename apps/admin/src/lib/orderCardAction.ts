import { operationalStatus, type OperationalStatus } from "@l-shopee/core";
import type { Phrase } from "./lang";

/**
 * What the phone order card's bottom row says and does.
 *
 * WHY IT EXISTS (owner's design D, 27 Aug 2026). The wide table ends every row in a จัดการ menu
 * holding exactly one item, "ดู". On a phone that is a button, a dropdown and a tap to reach the
 * one place the whole row already goes. The card replaces it with a line saying what the order is
 * waiting for and a button naming the next thing to do.
 *
 * THE BUTTON GOES TO THE SAME PLACE EVERY TIME — the order's own page. It is labelled by the action
 * waiting there, not by an action it performs itself: "ตรวจการชำระเงิน" opens the order whose
 * Zone A is the payment review. Nothing here can do anything the detail page cannot, which is the
 * point — the label is a promise about the destination, so it may only name what Zone A actually
 * offers for that status (OrderDetailView: isVerifying, isCodPending, isToShip, the refund block,
 * and an active claim).
 *
 * PRIMARY MEANS "YOU". A filled button marks the four-and-a-bit states that are waiting on the shop
 * — the same principle as the status colours in badges.ts, where only the states that need someone
 * to act earn a colour. An order in transit is not anybody's next job, so its button stays quiet.
 */
export interface OrderCardAction {
  /** The grey line: what this order is waiting for, in plain words. */
  hint: Phrase;
  /** The button's words — the action waiting on the order's page. */
  label: Phrase;
  /** Filled (waiting on us) rather than plain (nothing to do). */
  primary: boolean;
}

const VIEW: Phrase = { th: "ดู", en: "View" };

/** The words for each of the thirteen. Keyed by the type, so a fourteenth state cannot be added
 *  without a line and a button to go with it. */
const BY_STATUS: Record<OperationalStatus, OrderCardAction> = {
  unpaid: {
    hint: { th: "รอลูกค้าชำระเงิน", en: "Waiting for the customer to pay" },
    label: VIEW,
    primary: false,
  },
  verifying: {
    hint: { th: "ลูกค้าส่งสลิปแล้ว", en: "The customer sent a slip" },
    label: { th: "ตรวจการชำระเงิน", en: "Review payment" },
    primary: true,
  },
  cod_pending: {
    hint: { th: "รออนุมัติเก็บเงินปลายทาง", en: "Cash on delivery, awaiting approval" },
    label: { th: "อนุมัติปลายทาง", en: "Approve COD" },
    primary: true,
  },
  cod_reject: {
    hint: { th: "ปฏิเสธเก็บเงินปลายทางแล้ว", en: "Cash on delivery was refused" },
    label: VIEW,
    primary: false,
  },
  to_ship: {
    hint: { th: "รอแพ็กและส่ง", en: "Waiting to be packed and sent" },
    label: { th: "บันทึกการส่งของ", en: "Record drop-off" },
    primary: true,
  },
  in_transit: {
    hint: { th: "อยู่ระหว่างจัดส่ง", en: "On its way" },
    label: VIEW,
    primary: false,
  },
  complete: { hint: { th: "ส่งถึงแล้ว", en: "Delivered" }, label: VIEW, primary: false },
  return: {
    hint: { th: "พัสดุตีกลับ · เงินยังอยู่", en: "The parcel came back; the money is still live" },
    label: { th: "จัดการพัสดุตีกลับ", en: "Handle the return" },
    primary: true,
  },
  claim_pending: {
    hint: { th: "รอช่างตรวจสอบ", en: "Waiting for the mechanic" },
    label: { th: "ตรวจเคลม", en: "Review claim" },
    primary: true,
  },
  claimed: {
    hint: { th: "เคลมกำลังดำเนินการ", en: "Claim in progress" },
    label: { th: "ตรวจเคลม", en: "Review claim" },
    primary: true,
  },
  refunded: { hint: { th: "คืนเงินแล้ว", en: "Refunded" }, label: VIEW, primary: false },
  claim_rejected: {
    hint: { th: "ช่างไม่รับเคลม", en: "The mechanic refused the claim" },
    label: VIEW,
    primary: false,
  },
  fail: { hint: { th: "ยกเลิกแล้ว", en: "Cancelled" }, label: VIEW, primary: false },
};

/** Unreadable status (retired value, or Thai data from before migration 0069). A card with no
 *  button would be a dead end, so it falls back to the one action that is always true. */
const UNKNOWN: OrderCardAction = {
  hint: { th: "สถานะไม่ทราบ", en: "Status unknown" },
  label: VIEW,
  primary: false,
};

export function orderCardAction(
  orderStatus: string | null,
  paymentStatus: string | null,
): OrderCardAction {
  const s = operationalStatus(orderStatus, paymentStatus);
  return s == null ? UNKNOWN : BY_STATUS[s];
}
