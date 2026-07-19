"use client";

import { useCallback, useEffect, useState } from "react";
import type { AddressRow } from "@/app/api/account/addresses/route";
import { PROVINCES } from "@/lib/provinces";

/**
 * Client address book: list + make-default + delete (2-tap arm) + add via the same flat Thai
 * address form used at checkout and LINE registration (no cascading dropdowns). All mutations
 * send JSON content-type (guardMutation requires it); DELETE has no body by design.
 */

const EMPTY_FORM = {
  recipientName: "",
  phone: "",
  addressLine1: "",
  subdistrict: "",
  district: "",
  province: "",
  postalCode: "",
  isDefault: false,
};

export function AddressBook() {
  const [addresses, setAddresses] = useState<AddressRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/addresses");
      const data = (await res.json()) as { addresses?: AddressRow[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "โหลดที่อยู่ไม่สำเร็จ");
        setAddresses([]);
        return;
      }
      setAddresses(data.addresses ?? []);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setAddresses([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Armed delete disarms itself after 4 s of inaction.
  useEffect(() => {
    if (!armedDelete) return;
    const t = setTimeout(() => setArmedDelete(null), 4000);
    return () => clearTimeout(t);
  }, [armedDelete]);

  async function makeDefault(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/addresses/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "ตั้งค่าเริ่มต้นไม่สำเร็จ");
        return;
      }
      await load();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (armedDelete !== id) {
      setArmedDelete(id);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    setArmedDelete(null);
    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "ลบที่อยู่ไม่สำเร็จ");
        return;
      }
      await load();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  const formValid =
    form.recipientName.trim() !== "" &&
    form.phone.trim() !== "" &&
    form.addressLine1.trim() !== "" &&
    form.subdistrict.trim() !== "" &&
    form.district.trim() !== "" &&
    form.province !== "" &&
    /^\d{5}$/.test(form.postalCode);

  async function submitNew() {
    if (!formValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientName: form.recipientName.trim(),
          phone: form.phone.trim(),
          addressLine1: form.addressLine1.trim(),
          subdistrict: form.subdistrict.trim(),
          district: form.district.trim(),
          province: form.province,
          postalCode: form.postalCode,
          isDefault: form.isDefault,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "บันทึกที่อยู่ไม่สำเร็จ");
        return;
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  if (addresses === null) {
    return <p className="muted">กำลังโหลด…</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
      {addresses.length === 0 && !showForm && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p className="muted" style={{ margin: 0 }}>
            ยังไม่มีที่อยู่จัดส่ง
          </p>
        </div>
      )}

      {addresses.map((a) => (
        <div key={a.id} className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{a.recipientName}</span>
            {a.isDefault && <span className="pill soft">ค่าเริ่มต้น</span>}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {a.phone}
          </div>
          <div style={{ fontSize: 14, marginTop: 6 }}>
            {a.addressLine1} {a.subdistrict} {a.district} {a.province} {a.postalCode}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {!a.isDefault && (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void makeDefault(a.id)}
                style={{ fontSize: 13, padding: "8px 14px" }}
              >
                ตั้งเป็นค่าเริ่มต้น
              </button>
            )}
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void remove(a.id)}
              style={{
                fontSize: 13,
                padding: "8px 14px",
                color: "var(--danger)",
                borderColor: armedDelete === a.id ? "var(--danger)" : "var(--border)",
                background: armedDelete === a.id ? "var(--danger-soft)" : undefined,
              }}
            >
              {armedDelete === a.id ? "แตะอีกครั้งเพื่อยืนยันลบ" : "ลบ"}
            </button>
          </div>
        </div>
      ))}

      {showForm ? (
        <form
          className="card"
          style={{ padding: 16, paddingBottom: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            void submitNew();
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>เพิ่มที่อยู่ใหม่</div>
          <div className="field">
            <label htmlFor="ab-recipient">ชื่อผู้รับ</label>
            <input
              id="ab-recipient"
              className="input"
              type="text"
              autoComplete="name"
              value={form.recipientName}
              onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="ab-phone">เบอร์โทรผู้รับ</label>
            <input
              id="ab-phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="ab-address">ที่อยู่ (บ้านเลขที่ หมู่ ซอย ถนน)</label>
            <textarea
              id="ab-address"
              className="input"
              rows={2}
              autoComplete="street-address"
              value={form.addressLine1}
              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
              style={{ resize: "vertical" }}
              required
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12 }}>
            <div className="field">
              <label htmlFor="ab-subdistrict">ตำบล/แขวง</label>
              <input
                id="ab-subdistrict"
                className="input"
                type="text"
                value={form.subdistrict}
                onChange={(e) => setForm({ ...form, subdistrict: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ab-district">อำเภอ/เขต</label>
              <input
                id="ab-district"
                className="input"
                type="text"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ab-province">จังหวัด</label>
              <select
                id="ab-province"
                className="input"
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                required
              >
                <option value="">เลือกจังหวัด</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ab-postal">รหัสไปรษณีย์</label>
              <input
                id="ab-postal"
                className="input"
                type="text"
                inputMode="numeric"
                maxLength={5}
                autoComplete="postal-code"
                value={form.postalCode}
                onChange={(e) =>
                  setForm({ ...form, postalCode: e.target.value.replace(/\D/g, "").slice(0, 5) })
                }
                required
              />
            </div>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              marginBottom: 14,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
            />
            ตั้งเป็นค่าเริ่มต้น
          </label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!formValid || busy}
              style={{ flex: 1 }}
            >
              {busy ? "กำลังบันทึก…" : "บันทึกที่อยู่"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-block" onClick={() => setShowForm(true)}>
          + เพิ่มที่อยู่ใหม่
        </button>
      )}

      {error && (
        <p
          role="alert"
          style={{ margin: 0, color: "var(--danger)", fontSize: 13, fontWeight: 600 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
