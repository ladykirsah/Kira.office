"use client";

import { useRef, useState } from "react";

/** A JPEG copy small enough to store cheaply but still legible as evidence; falls back to the file. */
async function downscaleToJpeg(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  try {
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
      return await new Promise<Blob>((r) =>
        canvas.toBlob((b) => r(b ?? file), "image/jpeg", quality),
      );
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

const MAX_PHOTOS = 5;
const box = {
  width: 64,
  height: 64,
  borderRadius: 8,
  border: "1px solid var(--border)",
  objectFit: "cover" as const,
};

/**
 * Customer defect-claim form on the order tracking page: a free-form reason plus evidence — up to 5
 * photos (downscaled client-side) and 1 video — POSTed to /api/orders/claim, which files a `requested`
 * claim for a mechanic/super-admin to review. Shown on a delivered order with no active claim.
 */
export function ClaimRequest({
  orderRef,
  phone,
  onChanged,
}: {
  orderRef: string;
  phone: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("ref", orderRef);
      fd.set("phone", phone);
      fd.set("reason", reason.trim());
      for (const p of photos) {
        try {
          fd.append("photos", await downscaleToJpeg(p), "photo.jpg");
        } catch {
          fd.append("photos", p);
        }
      }
      if (video) fd.set("video", video);
      const res = await fetch("/api/orders/claim", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        setBusy(false);
        return;
      }
      onChanged();
    } catch {
      setError("ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง");
      setBusy(false);
    }
  }

  const wrap = { marginTop: 12, paddingTop: 14, borderTop: "1px solid var(--border)" } as const;
  const picker = {
    ...box,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px dashed var(--border)",
    background: "none",
    color: "var(--text-muted)",
    fontSize: 12,
    cursor: "pointer",
  } as const;
  const del = {
    position: "absolute" as const,
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: "50%",
    border: "none",
    background: "var(--danger)",
    color: "#fff",
    fontSize: 12,
    lineHeight: 1,
    cursor: "pointer",
  };

  if (!open) {
    return (
      <div style={wrap}>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
          สินค้ามีปัญหา? แจ้งเคลมได้ที่นี่
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          แจ้งเคลมสินค้า
        </button>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>แจ้งเคลมสินค้า</p>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        อธิบายอาการ แนบรูปได้สูงสุด 5 รูป และวิดีโอ 1 คลิป
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="อาการของสินค้า เช่น คอมเพรสเซอร์มีเสียงดัง ใช้งานได้ไม่ถึงเดือน"
        style={{
          width: "100%",
          padding: "9px 11px",
          fontSize: 14,
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxSizing: "border-box",
          marginBottom: 10,
        }}
      />

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const fs = Array.from(e.target.files ?? []);
          setPhotos((prev) => [...prev, ...fs].slice(0, MAX_PHOTOS));
          e.target.value = "";
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setVideo(f);
          e.target.value = "";
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative" }}>
            <div
              style={{
                ...box,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 4,
                fontSize: 10,
                lineHeight: 1.15,
                textAlign: "center",
                color: "var(--text-muted)",
                overflow: "hidden",
                wordBreak: "break-all",
              }}
            >
              <span style={{ fontSize: 20 }}>🖼️</span>
              <span style={{ marginTop: 2 }}>{p.name.slice(0, 14)}</span>
            </div>
            <button
              type="button"
              aria-label="ลบรูป"
              style={del}
              onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button type="button" style={picker} onClick={() => photoRef.current?.click()}>
            ＋ รูป
          </button>
        )}
        {video ? (
          <div style={{ position: "relative" }}>
            <div
              style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              🎬
            </div>
            <button type="button" aria-label="ลบวิดีโอ" style={del} onClick={() => setVideo(null)}>
              ×
            </button>
          </div>
        ) : (
          <button type="button" style={picker} onClick={() => videoRef.current?.click()}>
            ＋ วิดีโอ
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !reason.trim()}
          onClick={() => void submit()}
        >
          {busy ? "กำลังส่ง…" : "ส่งเคลม"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>
          ยกเลิก
        </button>
      </div>
      {error && (
        <div role="alert" style={{ marginTop: 8, color: "var(--danger)", fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}
