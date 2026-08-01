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

  // How the customer wants it resolved — chosen here, on the form.
  const [resolution, setResolution] = useState<"refund" | "exchange" | "">("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  // A single switch: ON keeps the order's address, OFF reveals the new-address form.
  const [useSameAddress, setUseSameAddress] = useState(true);
  const [addr, setAddr] = useState({
    recipientName: "",
    addressPhone: "",
    addressLine1: "",
    subdistrict: "",
    district: "",
    province: "",
    postalCode: "",
  });
  const setAddrField = (k: keyof typeof addr) => (e: { target: { value: string } }) =>
    setAddr((a) => ({ ...a, [k]: e.target.value }));

  const bankOk = !!bankName.trim() && !!accountNo.trim() && !!accountName.trim();
  const newAddrOk = Object.values(addr).every((v) => v.trim());
  const resolutionOk =
    resolution === "refund"
      ? bankOk
      : resolution === "exchange"
        ? useSameAddress || newAddrOk
        : false;
  const canSubmit = !!reason.trim() && resolutionOk;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("ref", orderRef);
      fd.set("phone", phone);
      fd.set("reason", reason.trim());
      fd.set("resolution", resolution);
      if (resolution === "refund") {
        fd.set("bankName", bankName.trim());
        fd.set("accountNo", accountNo.trim());
        fd.set("accountName", accountName.trim());
      } else if (resolution === "exchange") {
        fd.set("addressChoice", useSameAddress ? "same" : "new");
        if (!useSameAddress) {
          fd.set("recipientName", addr.recipientName.trim());
          fd.set("addressPhone", addr.addressPhone.trim());
          fd.set("addressLine1", addr.addressLine1.trim());
          fd.set("subdistrict", addr.subdistrict.trim());
          fd.set("district", addr.district.trim());
          fd.set("province", addr.province.trim());
          fd.set("postalCode", addr.postalCode.trim());
        }
      }
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
  const inputStyle = {
    width: "100%",
    padding: "9px 11px",
    fontSize: 14,
    border: "1px solid var(--border)",
    borderRadius: 8,
    boxSizing: "border-box" as const,
  };
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

      {/* how the customer wants it resolved — a multiple-choice form; the choice drives the admin flow */}
      <p style={{ fontSize: 14, fontWeight: 600, margin: "4px 0 8px" }}>
        ต้องการให้ดำเนินการอย่างไร
      </p>
      <div
        role="radiogroup"
        aria-label="วิธีการเคลม"
        style={{ display: "grid", gap: 8, marginBottom: resolution ? 12 : 4 }}
      >
        {(
          [
            { key: "refund", title: "รับเงินคืน", desc: "โอนเงินคืนเข้าบัญชีของคุณ" },
            { key: "exchange", title: "เปลี่ยนสินค้าใหม่", desc: "จัดส่งสินค้าใหม่ให้แทน" },
          ] as const
        ).map((opt) => {
          const on = resolution === opt.key;
          return (
            <label
              key={opt.key}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "11px 12px",
                border: `1px solid ${on ? "var(--danger)" : "var(--border)"}`,
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="resolution"
                checked={on}
                onChange={() => setResolution(opt.key)}
                style={{ marginTop: 3, accentColor: "var(--danger)" }}
              />
              <span>
                <span style={{ fontSize: 14, fontWeight: 600, display: "block" }}>{opt.title}</span>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{opt.desc}</span>
              </span>
            </label>
          );
        })}
      </div>

      {resolution === "refund" && (
        <div style={{ marginBottom: 12 }}>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
            กรอกบัญชีธนาคารของคุณ เมื่อผ่านการตรวจสอบ เราจะโอนคืนเต็มจำนวนภายใน 2–3 วันทำการ
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              style={inputStyle}
              placeholder="ธนาคาร (เช่น กสิกรไทย)"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
            <input
              style={inputStyle}
              inputMode="numeric"
              placeholder="เลขที่บัญชี"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="ชื่อบัญชี"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
        </div>
      )}

      {resolution === "exchange" && (
        <div style={{ marginBottom: 12 }}>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
            เมื่อผ่านการตรวจสอบ เราจะจัดส่งสินค้าใหม่ให้
          </p>
          {/* One switch: ON = ship to the order's address, OFF = fill a new one below. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              marginBottom: useSameAddress ? 0 : 10,
            }}
          >
            <span>
              <span style={{ fontSize: 14, fontWeight: 600, display: "block" }}>ที่อยู่เดิม</span>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {useSameAddress ? "ส่งไปที่อยู่ตามคำสั่งซื้อ" : "กรอกที่อยู่จัดส่งใหม่ด้านล่าง"}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={useSameAddress}
              aria-label="ใช้ที่อยู่เดิม"
              onClick={() => setUseSameAddress((v) => !v)}
              style={{
                flexShrink: 0,
                width: 46,
                height: 28,
                borderRadius: 999,
                border: "none",
                padding: 3,
                cursor: "pointer",
                background: useSameAddress ? "var(--danger)" : "var(--border)",
                display: "flex",
                justifyContent: useSameAddress ? "flex-end" : "flex-start",
                transition: "background .15s",
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff" }} />
            </button>
          </div>
          {!useSameAddress && (
            <div style={{ display: "grid", gap: 8 }}>
              <input
                style={inputStyle}
                placeholder="ชื่อผู้รับ"
                value={addr.recipientName}
                onChange={setAddrField("recipientName")}
              />
              <input
                style={inputStyle}
                inputMode="tel"
                placeholder="เบอร์โทรผู้รับ"
                value={addr.addressPhone}
                onChange={setAddrField("addressPhone")}
              />
              <input
                style={inputStyle}
                placeholder="บ้านเลขที่ ถนน หมู่บ้าน"
                value={addr.addressLine1}
                onChange={setAddrField("addressLine1")}
              />
              <input
                style={inputStyle}
                placeholder="ตำบล / แขวง"
                value={addr.subdistrict}
                onChange={setAddrField("subdistrict")}
              />
              <input
                style={inputStyle}
                placeholder="อำเภอ / เขต"
                value={addr.district}
                onChange={setAddrField("district")}
              />
              <input
                style={inputStyle}
                placeholder="จังหวัด"
                value={addr.province}
                onChange={setAddrField("province")}
              />
              <input
                style={inputStyle}
                inputMode="numeric"
                placeholder="รหัสไปรษณีย์"
                value={addr.postalCode}
                onChange={setAddrField("postalCode")}
              />
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !canSubmit}
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
