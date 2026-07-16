"use client";

import { useCallback, useEffect, useState } from "react";
import type { AddressRow } from "@/app/api/account/addresses/route";
import { Icon } from "@/components/Icon";
import { loadPostcodes, resolvePostcode, type PostcodeEntry } from "@/lib/thaiGeo";

/**
 * Client address book: list + make-default + delete (2-tap arm) + add via the same flat Thai
 * address form used at checkout (no cascading dropdowns). All mutations send JSON content-type
 * (guardMutation requires it); DELETE has no body by design.
 */

/** กรุงเทพมหานคร first (most orders), then the other 76 provinces alphabetically. */
const PROVINCES = [
  "กรุงเทพมหานคร",
  "กระบี่",
  "กาญจนบุรี",
  "กาฬสินธุ์",
  "กำแพงเพชร",
  "ขอนแก่น",
  "จันทบุรี",
  "ฉะเชิงเทรา",
  "ชลบุรี",
  "ชัยนาท",
  "ชัยภูมิ",
  "ชุมพร",
  "เชียงราย",
  "เชียงใหม่",
  "ตรัง",
  "ตราด",
  "ตาก",
  "นครนายก",
  "นครปฐม",
  "นครพนม",
  "นครราชสีมา",
  "นครศรีธรรมราช",
  "นครสวรรค์",
  "นนทบุรี",
  "นราธิวาส",
  "น่าน",
  "บึงกาฬ",
  "บุรีรัมย์",
  "ปทุมธานี",
  "ประจวบคีรีขันธ์",
  "ปราจีนบุรี",
  "ปัตตานี",
  "พระนครศรีอยุธยา",
  "พะเยา",
  "พังงา",
  "พัทลุง",
  "พิจิตร",
  "พิษณุโลก",
  "เพชรบุรี",
  "เพชรบูรณ์",
  "แพร่",
  "ภูเก็ต",
  "มหาสารคาม",
  "มุกดาหาร",
  "แม่ฮ่องสอน",
  "ยโสธร",
  "ยะลา",
  "ร้อยเอ็ด",
  "ระนอง",
  "ระยอง",
  "ราชบุรี",
  "ลพบุรี",
  "ลำปาง",
  "ลำพูน",
  "เลย",
  "ศรีสะเกษ",
  "สกลนคร",
  "สงขลา",
  "สตูล",
  "สมุทรปราการ",
  "สมุทรสงคราม",
  "สมุทรสาคร",
  "สระแก้ว",
  "สระบุรี",
  "สิงห์บุรี",
  "สุโขทัย",
  "สุพรรณบุรี",
  "สุราษฎร์ธานี",
  "สุรินทร์",
  "หนองคาย",
  "หนองบัวลำภู",
  "อ่างทอง",
  "อำนาจเจริญ",
  "อุดรธานี",
  "อุตรดิตถ์",
  "อุทัยธานี",
  "อุบลราชธานี",
];

const EMPTY_FORM = {
  recipientName: "",
  phone: "",
  addressLine1: "",
  subdistrict: "",
  district: "",
  province: "",
  postalCode: "",
  // Pre-checked: a newly added address becomes the default (the newest one), matching the API.
  // The server keeps exactly one default; unticking this opts the new address out.
  isDefault: true,
};

type FormState = typeof EMPTY_FORM;

export function AddressBook() {
  const [addresses, setAddresses] = useState<AddressRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const toFormState = (a: AddressRow): FormState => ({
    recipientName: a.recipientName,
    phone: a.phone,
    addressLine1: a.addressLine1,
    subdistrict: a.subdistrict,
    district: a.district,
    province: a.province,
    postalCode: a.postalCode,
    isDefault: a.isDefault,
  });

  // One save path for both add (POST) and edit (PATCH /:id). The set-default checkbox lives in the
  // form, so making an address the default is part of editing it — the API keeps exactly one default.
  async function save(payload: FormState, editId: string | null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        editId ? `/api/account/addresses/${editId}` : "/api/account/addresses",
        {
          method: editId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            recipientName: payload.recipientName.trim(),
            phone: payload.phone.trim(),
            addressLine1: payload.addressLine1.trim(),
            subdistrict: payload.subdistrict.trim(),
            district: payload.district.trim(),
            province: payload.province,
            postalCode: payload.postalCode,
            isDefault: payload.isDefault,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "บันทึกที่อยู่ไม่สำเร็จ");
        return;
      }
      setShowForm(false);
      setEditingId(null);
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

  if (addresses === null) {
    return <p className="muted">กำลังโหลด…</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
      {addresses.length === 0 && !showForm && !editingId && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p className="muted" style={{ margin: 0 }}>
            ยังไม่มีที่อยู่จัดส่ง
          </p>
        </div>
      )}

      {addresses.map((a) =>
        editingId === a.id ? (
          <AddressForm
            key={a.id}
            title="แก้ไขที่อยู่"
            initial={toFormState(a)}
            busy={busy}
            submitLabel="บันทึกการแก้ไข"
            onSubmit={(payload) => void save(payload, a.id)}
            onCancel={() => {
              setEditingId(null);
              setError(null);
            }}
          />
        ) : (
          <div key={a.id} className="card" style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              {/* Left: name · phone on one line. Right: the ค่าเริ่มต้น tag. */}
              <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{a.recipientName}</span>
                <span className="muted" style={{ fontSize: 13 }}>
                  · {a.phone}
                </span>
              </div>
              {a.isDefault && (
                <span className="pill soft" style={{ flex: "0 0 auto" }}>
                  ค่าเริ่มต้น
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, marginTop: 6 }}>
              {a.addressLine1} {a.subdistrict} {a.district} {a.province} {a.postalCode}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
              {/* Edit opens the address in an inline form (where "ตั้งเป็นค่าเริ่มต้น" now lives). */}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditingId(a.id);
                  setShowForm(false);
                  setArmedDelete(null);
                  setError(null);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 40,
                  padding: "0 20px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--gray-dark)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Edit
              </button>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                {/* Armed hint appears only after the first tap — a confirm cue, never a cancel. */}
                {armedDelete === a.id && (
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--danger)" }}>
                    แตะอีกครั้งเพื่อลบ
                  </span>
                )}
                {/* Trash-icon delete: tap once to arm (icon fills red), tap again to confirm. */}
                <button
                  type="button"
                  aria-label={armedDelete === a.id ? "แตะอีกครั้งเพื่อยืนยันลบ" : "ลบที่อยู่"}
                  disabled={busy}
                  onClick={() => void remove(a.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    flex: "0 0 auto",
                    borderRadius: 999,
                    border: "1px solid",
                    // Matches the Edit button: both are quiet 40px outline buttons with the same
                    // subtle border; only the content colour differs (Edit ink, Delete red icon).
                    borderColor: "var(--border)",
                    background: armedDelete === a.id ? "var(--danger)" : "transparent",
                    color: armedDelete === a.id ? "var(--white)" : "var(--danger)",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </div>
          </div>
        ),
      )}

      {editingId === null &&
        (showForm ? (
          <AddressForm
            title="เพิ่มที่อยู่ใหม่"
            initial={EMPTY_FORM}
            busy={busy}
            submitLabel="บันทึกที่อยู่"
            onSubmit={(payload) => void save(payload, null)}
            onCancel={() => {
              setShowForm(false);
              setError(null);
            }}
          />
        ) : (
          <button type="button" className="btn btn-block" onClick={() => setShowForm(true)}>
            + เพิ่มที่อยู่ใหม่
          </button>
        ))}

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

/** The address form, shared by add (empty) and edit (pre-filled). Owns its own field state so its
 *  parent only handles the resolved payload. "ตั้งเป็นค่าเริ่มต้น" lives here — set-default is part of
 *  editing an address, not a separate card action. */
function AddressForm({
  title,
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  initial: FormState;
  busy: boolean;
  submitLabel: string;
  onSubmit: (payload: FormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [tambons, setTambons] = useState<PostcodeEntry[]>([]);

  // Edit mode: populate the ตำบล dropdown from the saved zip WITHOUT overwriting the saved
  // จังหวัด/อำเภอ. initial.postalCode is stable for this form instance.
  useEffect(() => {
    if (!/^\d{5}$/.test(initial.postalCode)) return;
    let cancelled = false;
    void loadPostcodes().then((map) => {
      if (cancelled) return;
      const res = resolvePostcode(map, initial.postalCode);
      if (res) setTambons(res.tambons);
    });
    return () => {
      cancelled = true;
    };
  }, [initial.postalCode]);

  // Typing a 5-digit zip auto-fills จังหวัด + อำเภอ (still editable) and loads its ตำบล options.
  async function applyPostcode(zip: string) {
    const map = await loadPostcodes();
    const res = resolvePostcode(map, zip);
    setTambons(res ? res.tambons : []);
    if (res)
      setForm((f) =>
        f.postalCode === zip
          ? { ...f, province: res.province, district: res.amphoe, subdistrict: "" }
          : f,
      );
  }

  const valid =
    form.recipientName.trim() !== "" &&
    form.phone.trim() !== "" &&
    form.addressLine1.trim() !== "" &&
    form.subdistrict.trim() !== "" &&
    form.district.trim() !== "" &&
    form.province !== "" &&
    /^\d{5}$/.test(form.postalCode);
  const multiAmphoe = new Set(tambons.map((t) => t.amphoe)).size > 1;
  const tambonIdx = tambons.findIndex(
    (t) => t.tambon === form.subdistrict && t.amphoe === form.district,
  );

  return (
    <form
      className="card"
      style={{ padding: 16, paddingBottom: 6 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onSubmit(form);
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{title}</div>
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
      {/* Location, zip-first: the postcode fills จังหวัด/อำเภอ and offers this area's ตำบล. */}
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
          onChange={(e) => {
            const zip = e.target.value.replace(/\D/g, "").slice(0, 5);
            setForm({ ...form, postalCode: zip });
            if (/^\d{5}$/.test(zip)) void applyPostcode(zip);
            else setTambons([]);
          }}
          required
        />
        <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          กรอกรหัสไปรษณีย์ ระบบจะเติมจังหวัด/อำเภอ และให้เลือกตำบลของพื้นที่นั้น
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12 }}>
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
      </div>
      <div className="field">
        <label htmlFor="ab-subdistrict">ตำบล/แขวง</label>
        {tambons.length > 0 ? (
          <select
            id="ab-subdistrict"
            className="input"
            value={tambonIdx >= 0 ? String(tambonIdx) : ""}
            onChange={(e) => {
              const t = tambons[Number(e.target.value)];
              if (t)
                setForm({
                  ...form,
                  subdistrict: t.tambon,
                  district: t.amphoe,
                  province: t.province,
                });
            }}
            required
          >
            <option value="">เลือกตำบล/แขวง</option>
            {tambons.map((t, i) => (
              <option key={i} value={i}>
                {t.tambon}
                {multiAmphoe ? ` · ${t.amphoe}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="ab-subdistrict"
            className="input"
            type="text"
            value={form.subdistrict}
            onChange={(e) => setForm({ ...form, subdistrict: e.target.value })}
            required
          />
        )}
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
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          ยกเลิก
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!valid || busy}
          style={{ flex: 1 }}
        >
          {busy ? "กำลังบันทึก…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
