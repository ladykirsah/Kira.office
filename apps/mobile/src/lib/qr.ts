import { buildPromptPayPayload } from "@l-shopee/core";
import qrcode from "qrcode-generator";

/**
 * The PromptPay QR a mechanic scans to pay, as a grid of dark squares: the shop's EMVCo payload
 * (built by @l-shopee/core, the same as the printed bill's) with the amount baked in. Null when the
 * account's PromptPay ID is not a valid one, so the screen says so instead of showing a dead QR.
 */
export function payQr(promptpayId: string, amountSatang: number): boolean[][] | null {
  let payload: string;
  try {
    payload = buildPromptPayPayload({ target: promptpayId, amountSatang });
  } catch {
    return null;
  }
  const qr = qrcode(0, "M"); // auto size, error correction M (the EMVCo recommendation)
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
