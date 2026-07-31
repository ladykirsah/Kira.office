"use client";

import { useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Bank-transfer slip upload: decodes the slip's mini-QR CLIENT-SIDE (jsQR on a canvas) for
 * verification, and also uploads a downscaled copy of the image so the back office keeps the slip as
 * evidence (owner, 31 Jul 2026). The server auto-verifies via SlipOK when configured, or holds the
 * payload for the owner's manual review when not; either way the stored slip is super-admin-only.
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

/** A JPEG copy small enough to store cheaply but still legible as evidence. Falls back to the
 *  original file if the canvas is unavailable. */
async function downscaleToJpeg(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality),
    );
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
      // multipart: QR text for verification + the image itself for evidence. No explicit
      // content-type — the browser sets the multipart boundary. The image is best-effort; if it
      // can't be produced the QR still goes and the slip verifies as before.
      const fd = new FormData();
      fd.set("ref", orderRef);
      fd.set("phone", phone);
      fd.set("qrData", qrData);
      try {
        fd.set("slip", await downscaleToJpeg(file), "slip.jpg");
      } catch {
        // evidence image is optional; proceed with the QR text alone
      }
      const res = await fetch("/api/payments/slip", { method: "POST", body: fd });
      const body = (await res.json()) as { status?: string; message?: string; error?: string };
      if (!res.ok) {
        setPhase({ kind: "error", message: body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่" });
        return;
      }
      const confirmed = body.status === "confirmed";
      setPhase({ kind: "done", confirmed, message: body.message ?? "ส่งสลิปเรียบร้อย" });
      // Refresh on BOTH outcomes, not just auto-confirmation. In manual-review mode (which is what
      // runs today — SlipOK is not configured) the response is "received", and the order really did
      // move to `verifying`. Only refreshing on "confirmed" left the timeline showing the stale
      // ยังไม่ชำระเงิน, so a customer who had just paid was still told they had not.
      if (confirmed || body.status === "received") onConfirmed?.();
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
      {/* Primary, filled. This is the action the customer came here to do — an unpaid order is
          blocked on it, so it should not have been wearing the outlined style of a secondary. */}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {phase.kind === "decoding"
          ? "กำลังอ่านสลิป…"
          : phase.kind === "submitting"
            ? "กำลังส่งสลิป…"
            : "แนบสลิปการโอนเงิน"}
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
