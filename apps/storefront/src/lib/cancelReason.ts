import { cancelReasonLabel, isCancelReason } from "@l-shopee/core";

/**
 * The grey line under "ยกเลิกคำสั่งซื้อ" on the order-tracking page: the shop's reason first (owner,
 * 30 Oct 2026: "show cancel reason to customers"), then the refund's progress when money is owed.
 * The words are the back office's own, so the shop and the customer read the same reason.
 */
export function cancelStepDetail(reason: string | null, rest: string | null): string | null {
  const why = isCancelReason(reason) ? `เหตุผล: ${cancelReasonLabel(reason)}` : null;
  return [why, rest].filter(Boolean).join(" · ") || null;
}
