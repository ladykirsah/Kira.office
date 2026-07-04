"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { chooseBarcodeFormat } from "@/lib/barcode";

/** Live, scannable barcode rendered from a typed value. EAN-13 for 13 digits, else Code 128. */
export function BarcodePreview({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const format = chooseBarcodeFormat(value);
  const v = value.trim();

  useEffect(() => {
    const el = ref.current;
    if (!el || !format) return;
    const opts = { height: 48, width: 1.6, fontSize: 12, margin: 6, displayValue: true } as const;
    try {
      JsBarcode(el, v, { format, ...opts });
    } catch {
      // e.g. 13 digits with a bad EAN-13 checksum — Code 128 renders any value.
      try {
        JsBarcode(el, v, { format: "CODE128", ...opts });
      } catch {
        /* unrenderable — leave blank */
      }
    }
  }, [v, format]);

  if (!format) {
    return <small className="muted">Enter a barcode to preview.</small>;
  }

  return (
    <span
      style={{
        display: "inline-block",
        background: "#fff",
        borderRadius: 8,
        padding: 4,
        maxWidth: 320,
        flexShrink: 0,
      }}
    >
      <svg
        ref={ref}
        aria-label={`Barcode ${v}`}
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      />
    </span>
  );
}
