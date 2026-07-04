"use client";

import { useState } from "react";
import { updateCarModel, type CarModelNode, type OringEntry } from "@/lib/api";
import { useToast } from "../../ToastProvider";

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

/** Inline editor for one car model's service notes — the cheat sheet used at customer-service time. */
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
  // Preserved (no longer edited in this form): keep the model's existing values so save doesn't wipe them.
  const generationCode = model.generationCode ?? "";
  const yearFrom = model.yearFrom?.toString() ?? "";
  const yearTo = model.yearTo?.toString() ?? "";
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
      await updateCarModel(model.id, {
        generationCode: generationCode.trim() || null,
        yearFrom: yearOrNull(yearFrom),
        yearTo: yearOrNull(yearTo),
        refrigerant: refrigerant.trim() || null,
        oringUsage,
        coolantLiters: coolantLiters.trim() || null,
        notes: notes.trim() || null,
      });
      toast("Saved ✓", "success");
      onSaved();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="md-minfo">
      <div className="md-oring">
        <Label>O-ring usage — how many of each size this model uses</Label>
        <div className="md-oring-grid">
          {BASIC_SIZES.map((size) => (
            <div className="md-oring-cell" key={size}>
              <span className="md-oring-sz">{size}</span>
              <input
                value={basicQty[size] ?? ""}
                onChange={(e) => setBasic(size, e.target.value)}
                placeholder="0"
                inputMode="numeric"
                aria-label={`Amount of ${size} o-rings`}
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
                aria-label="O-ring size"
                className="md-oring-szin"
              />
              <input
                value={sp.qty}
                onChange={(e) => setSpecial(i, { qty: e.target.value.replace(/[^\d]/g, "") })}
                placeholder="0"
                inputMode="numeric"
                aria-label="Amount"
                className="md-oring-amt"
              />
              <button
                type="button"
                className="icon-del"
                aria-label="Remove size"
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
          + add size
        </button>
      </div>

      <label style={{ display: "block", marginTop: 12 }}>
        <Label>Notes (for customer service)</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything worth remembering — compressor model, belt size, connector quirks…"
          style={{ width: "100%" }}
        />
      </label>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="button" className="btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save notes"}
        </button>
        {onCancel && (
          <button type="button" className="btn-sm" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
