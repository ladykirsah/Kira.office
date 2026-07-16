"use client";

import { useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Bank-transfer slip upload: decodes the slip's mini-QR CLIENT-SIDE (jsQR on a canvas), then
 * submits only the QR payload string — no image ever leaves the phone (smaller, faster, and no
 * image storage needed server-side). The server auto-verifies via SlipOK when configured, or
 * holds the payload for the owner's manual review when not.
 */

type Phase =
  | { kind: "idle" }
  | { kind: "decoding" }
  | { kind: "submitting" }
  | { kind: "done"; confirmed: boolean; message: string }
  | { kind: "error"; message: string };

async function decodeQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    // Try native size first, then downscaled (huge photos can defeat the decoder).
    for (const maxSide of [1600, 800]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const hit = jsQR(data.data, w, h);
      if (hit?.data) return hit.data;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

export function SlipUpload({
  orderRef,
  phone,
  onConfirmed,
}: {
  orderRef: string;
  phone: string;
  onConfirmed?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setPhase({ kind: "decoding" });
    let qrData: string | null = null;
    try {
      qrData = await decodeQrFromFile(file);
    } catch {
      qrData = null;
    }
    if (!qrData) {
      setPhase({
        kind: "error",
        message: "อ่าน QR จากรูปไม่ได้ กรุณาใช้รูปสลิปเต็มใบที่เห็น QR ชัดเจน",
      });
      return;
    }
    setPhase({ kind: "submitting" });
    try {
      const res = await fetch("/api/payments/slip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: orderRef, phone, qrData }),
      });
      const body = (await res.json()) as { status?: string; message?: string; error?: string };
      if (!res.ok) {
        setPhase({ kind: "error", message: body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่" });
        return;
      }
      const confirmed = body.status === "confirmed";
      setPhase({ kind: "done", confirmed, message: body.message ?? "ส่งสลิปเรียบร้อย" });
      if (confirmed) onConfirmed?.();
    } catch {
      setPhase({ kind: "error", message: "ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง" });
    }
  }

  const busy = phase.kind === "decoding" || phase.kind === "submitting";

  if (phase.kind === "done") {
    return (
      <div
        className="card"
        role="status"
        style={{
          padding: 14,
          background: phase.confirmed ? "var(--ok-soft)" : "var(--accent-soft)",
          borderColor: "transparent",
          color: phase.confirmed ? "var(--ok)" : "var(--accent)",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {phase.confirmed ? "✓ " : ""}
        {phase.message}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      {/* The CI's coral-outline button, not a hand-rolled one. This used to be `.btn` (whose base is
          a DARK charcoal fill) with only the border+text recoloured to coral — leaving coral text on
          a near-black pill, which is both off-CI and poor contrast. btn-outline btn-primary is the
          same intent done by the system, and it brings the hover state the override silently lost. */}
      <button
        type="button"
        className="btn btn-block btn-outline btn-primary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {phase.kind === "decoding"
          ? "กำลังอ่านสลิป…"
          : phase.kind === "submitting"
            ? "กำลังส่งสลิป…"
            : "แนบสลิปโอนเงิน"}
      </button>
      {phase.kind === "error" && (
        <div
          role="alert"
          style={{ marginTop: 8, color: "var(--danger)", fontSize: 13, fontWeight: 600 }}
        >
          {phase.message}
        </div>
      )}
    </div>
  );
}
