"use client";

import { useState } from "react";
import { updateCarModel, setAttributeNames, type CarModelNode, type OringEntry } from "@/lib/api";
import { inputS } from "@/lib/inputStyles";
import { useToast } from "../../ToastProvider";
import { useT } from "../../LangProvider";
import type { Phrase } from "@/lib/lang";

const EN_NAME: Phrase = { th: "ชื่อภาษาอังกฤษ", en: "English name" };
const TH_NAME: Phrase = { th: "ชื่อภาษาไทย", en: "Thai name" };
const YEAR_FROM: Phrase = { th: "ปีเริ่ม", en: "Year from" };
const YEAR_TO: Phrase = { th: "ปีสิ้นสุด", en: "Year to" };

const BASIC_SIZES = ['3/8"', '1/2"', '5/8"'];

const yearOrNull = (s: string): number | null => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

const Label = ({ children }: { children: string }) => (
  <span style={{ fontSize: 12, color: "var(--text-faint)", display: "block", marginBottom: 3 }}>
    {children}
  </span>
);

/** Seed the three basic sizes' amounts (as strings) from the model's saved o-ring usage. */
function seedBasic(model: CarModelNode): Record<string, string> {
  const m: Record<string, string> = { '3/8"': "", '1/2"': "", '5/8"': "" };
  for (const e of model.oringUsage ?? []) {
    if (BASIC_SIZES.includes(e.size)) m[e.size] = String(e.qty);
  }
  return m;
}

/** Special (non-basic) sizes the model uses, as editable {size, qty-string} rows. */
function seedSpecials(model: CarModelNode): { size: string; qty: string }[] {
  return (model.oringUsage ?? [])
    .filter((e) => !BASIC_SIZES.includes(e.size))
    .map((e) => ({ size: e.size, qty: String(e.qty) }));
}

/**
 * The one editor for a car model — English / Thai name, year range, and the service-notes cheat
 * sheet (o-ring usage + notes), all saved together from the row's single Edit pencil. Names go to
 * the display columns (setAttributeNames); the rest to updateCarModel.
 */
export function ModelInfoEditor({
  model,
  onSaved,
  onCancel,
}: {
  model: CarModelNode;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const [enName, setEnName] = useState(model.nameEn ?? "");
  const [thName, setThName] = useState(model.nameTh ?? "");
  const [yearFrom, setYearFrom] = useState(model.yearFrom?.toString() ?? "");
  const [yearTo, setYearTo] = useState(model.yearTo?.toString() ?? "");
  // Preserved (not surfaced in this form): keep the model's existing values so save doesn't wipe them.
  const t = useT();
  const generationCode = model.generationCode ?? "";
  const refrigerant = model.refrigerant ?? "";
  const coolantLiters = model.coolantLiters ?? "";
  const [basicQty, setBasicQty] = useState<Record<string, string>>(() => seedBasic(model));
  const [specials, setSpecials] = useState<{ size: string; qty: string }[]>(() =>
    seedSpecials(model),
  );
  const [notes, setNotes] = useState(model.notes ?? "");
  const [saving, setSaving] = useState(false);

  const setBasic = (size: string, v: string) =>
    setBasicQty((cur) => ({ ...cur, [size]: v.replace(/[^\d]/g, "") }));
  const setSpecial = (i: number, patch: Partial<{ size: string; qty: string }>) =>
    setSpecials((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addSpecial = () => setSpecials((cur) => [...cur, { size: "", qty: "" }]);
  const removeSpecial = (i: number) => setSpecials((cur) => cur.filter((_, j) => j !== i));

  async function save() {
    const oringUsage: OringEntry[] = [];
    for (const size of BASIC_SIZES) {
      const qty = parseInt(basicQty[size] ?? "", 10);
      if (Number.isFinite(qty) && qty > 0) oringUsage.push({ size, qty });
    }
    for (const sp of specials) {
      const size = sp.size.trim();
      const qty = parseInt(sp.qty, 10);
      if (size && Number.isFinite(qty) && qty > 0) oringUsage.push({ size, qty });
    }
    setSaving(true);
    try {
      await setAttributeNames("car_model", model.id, {
        nameTh: thName.trim() || null,
        nameEn: enName.trim() || null,
      });
      await updateCarModel(model.id, {
        generationCode: generationCode.trim() || null,
        yearFrom: yearOrNull(yearFrom),
        yearTo: yearOrNull(yearTo),
        refrigerant: refrigerant.trim() || null,
        oringUsage,
        coolantLiters: coolantLiters.trim() || null,
        notes: notes.trim() || null,
      });
      toast(t({ th: "บันทึกแล้ว ✓", en: "Saved ✓" }), "success");
      onSaved();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="md-minfo">
      {/* Names + year — the identity/display fields for this model. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <label>
          <Label>{t(EN_NAME)}</Label>
          <input
            value={enName}
            onChange={(e) => setEnName(e.target.value)}
            placeholder="English name"
            aria-label={t({
              th: `ชื่อภาษาอังกฤษของ ${model.name}`,
              en: `English name for ${model.name}`,
            })}
            style={{ ...inputS, width: "100%" }}
          />
        </label>
        <label>
          <Label>{t(TH_NAME)}</Label>
          <input
            value={thName}
            onChange={(e) => setThName(e.target.value)}
            placeholder="ชื่อภาษาไทย"
            aria-label={t({
              th: `ชื่อภาษาไทยของ ${model.name}`,
              en: `Thai name for ${model.name}`,
            })}
            style={{ ...inputS, width: "100%" }}
          />
        </label>
        <label>
          <Label>{t(YEAR_FROM)}</Label>
          <input
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
            inputMode="numeric"
            placeholder="from"
            aria-label={t(YEAR_FROM)}
            style={{ ...inputS, width: "100%" }}
          />
        </label>
        <label>
          <Label>{t(YEAR_TO)}</Label>
          <input
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
            inputMode="numeric"
            placeholder="to"
            aria-label={t(YEAR_TO)}
            style={{ ...inputS, width: "100%" }}
          />
        </label>
      </div>

      <div className="md-oring">
        <Label>
          {t({
            th: "โอริงที่ใช้ — รุ่นนี้ใช้แต่ละขนาดกี่ตัว",
            en: "O-ring usage — how many of each size this model uses",
          })}
        </Label>
        <div className="md-oring-grid">
          {BASIC_SIZES.map((size) => (
            <div className="md-oring-cell" key={size}>
              <span className="md-oring-sz">{size}</span>
              <input
                value={basicQty[size] ?? ""}
                onChange={(e) => setBasic(size, e.target.value)}
                placeholder="0"
                inputMode="numeric"
                aria-label={t({ th: `จำนวนโอริงขนาด ${size}`, en: `Amount of ${size} o-rings` })}
                className="md-oring-amt"
              />
            </div>
          ))}
          {specials.map((sp, i) => (
            <div className="md-oring-cell" key={i}>
              <input
                value={sp.size}
                onChange={(e) => setSpecial(i, { size: e.target.value })}
                placeholder="ETC"
                aria-label={t({ th: "ขนาดโอริง", en: "O-ring size" })}
                className="md-oring-szin"
              />
              <input
                value={sp.qty}
                onChange={(e) => setSpecial(i, { qty: e.target.value.replace(/[^\d]/g, "") })}
                placeholder="0"
                inputMode="numeric"
                aria-label={t({ th: "จำนวน", en: "Amount" })}
                className="md-oring-amt"
              />
              <button
                type="button"
                className="icon-del"
                aria-label={t({ th: "ลบขนาดนี้", en: "Remove size" })}
                onClick={() => removeSpecial(i)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 7h16" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                  <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-soft" onClick={addSpecial} style={{ marginTop: 10 }}>
          + {t({ th: "เพิ่มขนาด", en: "add size" })}
        </button>
      </div>

      <label style={{ display: "block", marginTop: 12 }}>
        <Label>{t({ th: "บันทึก (สำหรับตอบลูกค้า)", en: "Notes (for customer service)" })}</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={t({
            th: "อะไรก็ตามที่ควรจำไว้ — รุ่นคอมเพรสเซอร์ ขนาดสายพาน ข้อต่อที่มีลูกเล่น…",
            en: "Anything worth remembering — compressor model, belt size, connector quirks…",
          })}
          style={{ width: "100%" }}
        />
      </label>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="button" className="btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? t({ th: "กำลังบันทึก…", en: "Saving…" }) : t({ th: "บันทึก", en: "Save" })}
        </button>
        {onCancel && (
          <button type="button" className="btn-sm" onClick={onCancel} disabled={saving}>
            {t({ th: "ยกเลิก", en: "Cancel" })}
          </button>
        )}
      </div>
    </div>
  );
}
