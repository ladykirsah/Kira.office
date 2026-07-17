"use client";

import { useState, type RefObject } from "react";
import { shareImageOrDownload } from "@/lib/share";

/**
 * "Save QR" for the pay-from-one-phone flow: you can't scan a QR shown on the same screen you'd scan
 * WITH, so this rasterizes the PromptPay QR (an inline SVG) to a PNG and hands it to the OS —
 * on mobile the share sheet offers "Save Image" (→ Photos) / "send to a banking app"; where Web Share
 * can't take files (most desktops) it falls back to a normal download. The bank app then scans the
 * saved image from the gallery.
 */

/** Rasterize an inline SVG to a PNG blob at `px`×`px`. Data-URL source keeps the canvas untainted
 *  (no external refs), so toBlob succeeds. */
async function svgToPngBlob(svg: SVGSVGElement, px: number): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(px));
  clone.setAttribute("height", String(px));
  const xml = new XMLSerializer().serializeToString(clone);
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("qr image load failed"));
    img.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#fff"; // white margin so the code scans cleanly
  ctx.fillRect(0, 0, px, px);
  ctx.drawImage(img, 0, 0, px, px);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}

type State = "idle" | "working" | "done" | "error";

const LABEL: Record<State, string> = {
  idle: "บันทึก QR code",
  working: "กำลังบันทึก…",
  done: "บันทึกแล้ว ✓",
  error: "บันทึกไม่สำเร็จ ลองใหม่",
};

export function SaveQrButton({
  qrRef,
  filename,
}: {
  qrRef: RefObject<HTMLDivElement | null>;
  filename: string;
}) {
  const [state, setState] = useState<State>("idle");

  async function save() {
    const svg = qrRef.current?.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return;
    setState("working");
    try {
      const blob = await svgToPngBlob(svg, 720);
      const file = new File([blob], filename, { type: "image/png" });
      const outcome = await shareImageOrDownload(navigator, file, "PromptPay QR — AirPlus");
      if (outcome === "download") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      // A cancelled share sheet is not an error — the QR is still on screen; just reset quietly.
      setState(outcome === "cancelled" ? "idle" : "done");
      if (outcome !== "cancelled") setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2400);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-block btn-primary"
      style={{ marginTop: 12 }}
      onClick={save}
      disabled={state === "working"}
    >
      {LABEL[state]}
    </button>
  );
}
