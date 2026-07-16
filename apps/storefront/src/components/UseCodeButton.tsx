"use client";

import { useState } from "react";
import { copyToClipboard } from "@/lib/coupons";

/** "ใช้โค้ด" — copies a collected coupon's code so the shopper can paste it at checkout. Gives
 *  "คัดลอกแล้ว ✓" only on a real copy (no false success if the clipboard is blocked). */
export function UseCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-primary coupon-use"
      onClick={async () => {
        if (await copyToClipboard(code)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
    >
      {copied ? "คัดลอกแล้ว ✓" : "ใช้โค้ด"}
    </button>
  );
}
