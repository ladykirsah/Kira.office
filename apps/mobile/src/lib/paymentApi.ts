import type { PaymentRow } from "./paymentPage";
import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/** The การชำระเงิน list (uncleared payments) and whether slip checking is switched on. */
export async function fetchPayments(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<{ payments: PaymentRow[]; slipCheckOn: boolean }> {
  const res = await fetchFn(`${base}/payments`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Payments failed to load");
  const body = (await res.json()) as { payments: PaymentRow[]; slipVerifyEnabled?: boolean };
  return { payments: body.payments, slipCheckOn: body.slipVerifyEnabled === true };
}

/** ลูกค้าโอนแล้ว · บันทึก: the money goes on the list; the saved row comes back for รับเงินแล้ว. */
export async function takePayment(
  fetchFn: FetchFn,
  base: string,
  token: string,
  take: { methodLabel: string; promptpayId: string; amountSatang: number },
): Promise<PaymentRow> {
  const res = await fetchFn(`${base}/payments`, sendJson(token, take));
  if (!res.ok) throw await failure(res, "Payment was not recorded");
  return ((await res.json()) as { payment: PaymentRow }).payment;
}

/** ล้าง (the owner's alone): every payment on the list is marked checked; the records stay. */
export async function clearPayments(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<number> {
  const res = await fetchFn(`${base}/payments/clear`, { method: "POST", headers: session(token) });
  if (!res.ok) throw await failure(res, "The list was not cleared");
  return ((await res.json()) as { cleared: number }).cleared;
}

/** ตรวจสลิป: the QR on the customer's slip, checked with the bank; answers the bank's reference. */
export async function verifySlip(
  fetchFn: FetchFn,
  base: string,
  token: string,
  paymentId: string,
  qrData: string,
): Promise<string> {
  const res = await fetchFn(
    `${base}/payments/${encodeURIComponent(paymentId)}/verify-slip`,
    sendJson(token, { qrData }),
  );
  if (!res.ok) throw await failure(res, "The slip was not checked");
  return ((await res.json()) as { ref: string }).ref;
}
