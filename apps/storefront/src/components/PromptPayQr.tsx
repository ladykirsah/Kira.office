"use client";

import qrcode from "qrcode-generator";
import { buildPromptPayPayload } from "@l-shopee/core";

/**
 * Scan-to-pay PromptPay QR for the printed bill: EMVCo payload (from @l-shopee/core, TDD'd +
 * cross-checked against the reference promptpay-qr implementation) rendered as a crisp SVG.
 * Renders nothing when the ID is invalid/blank — a bad setting must never break bill printing.
 */
export function PromptPayQr({
  promptpayId,
  amountSatang,
  size,
}: {
  promptpayId: string;
  amountSatang: number;
  size: number;
}) {
  let modules: boolean[][];
  try {
    const payload = buildPromptPayPayload({ target: promptpayId, amountSatang });
    const qr = qrcode(0, "M"); // type 0 = auto-size, error correction M (EMVCo recommendation)
    qr.addData(payload);
    qr.make();
    const n = qr.getModuleCount();
    modules = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => qr.isDark(r, c)),
    );
  } catch {
    return null;
  }
  const n = modules.length;
  // One SVG path of 1x1 squares on an n×n viewBox (+2 quiet-zone), scaled by `size` — crisp in print.
  const d = modules
    .flatMap((row, r) => row.map((dark, c) => (dark ? `M${c + 2} ${r + 2}h1v1h-1z` : "")))
    .join("");
  const box = n + 4; // 2-module quiet zone each side
  return (
    <svg
      viewBox={`0 0 ${box} ${box}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label="PromptPay QR"
    >
      <rect width={box} height={box} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
