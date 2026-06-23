"use client";

import { useState } from "react";
import { updateCarModel, type CarModelNode } from "@/lib/api";
import { Combobox } from "../../products/Combobox";
import { useToast } from "../../ToastProvider";

const ORING_SIZES = ['3/8"', '1/2"', '5/8"'];

const yearOrNull = (s: string): number | null => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

const Label = ({ children }: { children: string }) => (
  <span style={{ fontSize: 12, color: "var(--text-faint)", display: "block", marginBottom: 3 }}>
    {children}
  </span>
);

/** Inline editor for one car model's service notes — the cheat sheet used at customer-service time. */
export function ModelInfoEditor({ model, onSaved }: { model: CarModelNode; onSaved: () => void }) {
  const toast = useToast();
  const [generationCode, setGen] = useState(model.generationCode ?? "");
  const [yearFrom, setYearFrom] = useState(model.yearFrom?.toString() ?? "");
  const [yearTo, setYearTo] = useState(model.yearTo?.toString() ?? "");
  const [refrigerant, setRefrigerant] = useState(model.refrigerant ?? "");
  const [oringSize, setOring] = useState(model.oringSize ?? "");
  const [coolantLiters, setCoolant] = useState(model.coolantLiters ?? "");
  const [notes, setNotes] = useState(model.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateCarModel(model.id, {
        generationCode: generationCode.trim() || null,
        yearFrom: yearOrNull(yearFrom),
        yearTo: yearOrNull(yearTo),
        refrigerant: refrigerant.trim() || null,
        oringSize: oringSize.trim() || null,
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
      <div className="md-minfo-grid">
        <label>
          <Label>Generation / chassis</Label>
          <input
            value={generationCode}
            onChange={(e) => setGen(e.target.value)}
            placeholder="e.g. NCP150"
            style={{ width: "100%" }}
          />
        </label>
        <label>
          <Label>Years</Label>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              placeholder="from"
              inputMode="numeric"
              style={{ width: "min(72px, 100%)" }}
            />
            <span className="muted">–</span>
            <input
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              placeholder="to"
              inputMode="numeric"
              style={{ width: "min(72px, 100%)" }}
            />
          </span>
        </label>
        <label>
          <Label>Refrigerant</Label>
          <input
            value={refrigerant}
            onChange={(e) => setRefrigerant(e.target.value)}
            placeholder="e.g. R134a"
            style={{ width: "100%" }}
          />
        </label>
        <label>
          <Label>O-ring size</Label>
          <Combobox
            value={oringSize}
            onChange={setOring}
            options={ORING_SIZES}
            placeholder={'e.g. 1/2" or special'}
          />
        </label>
        <label>
          <Label>Coolant (liters)</Label>
          <input
            value={coolantLiters}
            onChange={(e) => setCoolant(e.target.value)}
            placeholder="e.g. 0.45"
            inputMode="decimal"
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <label style={{ display: "block", marginTop: 10 }}>
        <Label>Notes (for customer service)</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything worth remembering — compressor model, belt size, connector quirks…"
          style={{ width: "100%" }}
        />
      </label>

      <div style={{ marginTop: 10 }}>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save notes"}
        </button>
      </div>
    </div>
  );
}
