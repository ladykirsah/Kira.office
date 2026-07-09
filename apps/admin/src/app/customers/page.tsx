"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { PageHeader } from "../PageHeader";
import { BackLink } from "../BackLink";
import { TableFrame } from "../TableFrame";
import {
  searchCustomers,
  getCustomerDetail,
  saveCustomer,
  importCustomersCsv,
  importCustomerHistoryCsv,
  type CustomerImportResult,
  type CustomerLegacyEntry,
  type CustomerListItem,
  type CustomerDetail,
  type CustomerSale,
  type CustomerSaleLine,
  type HistoryImportResult,
} from "@/lib/api";
import {
  CUSTOMER_HISTORY_FIELDS,
  CUSTOMER_IMPORT_FIELDS,
  guessCustomerMapping,
  guessHistoryMapping,
  looksLikeCombinedSheet,
  looksLikeHistorySheet,
  looksLikeRichSheet,
  parseRichSheet,
  splitCombinedSheet,
  parseCsv,
  rowsToCsv,
  xlsxToRows,
} from "@l-shopee/core";
import { THAI_PROVINCES } from "@/lib/provinces";
import { formatBahtTrim } from "@/lib/format";
import { stripCarYear, carYearOf } from "@/lib/badges";
import { inputS } from "@/lib/inputStyles";
import { tableText } from "@/lib/tableText";
import { useToast } from "../ToastProvider";

// The combined transcription sheet's fixed template headers (one block per car; splitCombinedSheet
// generates exactly these two shapes, so the mappings are constants, not user-picked).
const CUST_TEMPLATE_MAPPING = {
  license_plate: "ทะเบียน",
  plate_province: "จังหวัด",
  customer_name: "ชื่อลูกค้า",
  phone: "เบอร์โทร",
  car_model: "รุ่นรถ",
  notes: "หมายเหตุ",
};
const HIST_TEMPLATE_MAPPING = {
  license_plate: "ทะเบียน",
  happened_at: "วันที่",
  description: "รายการ",
};

const frame = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 18,
  background: "var(--surface)",
} as const;
const rowBetween = { display: "flex", justifyContent: "space-between", gap: 16 } as const;
const num = { whiteSpace: "nowrap" } as const;
const right = { textAlign: "right" } as const;
const lineTotal = (l: CustomerSaleLine) => l.unitPriceSatang * l.quantity - l.discountSatang;

/** One bill/quotation as a fully-shown table row: date · bill · all items+prices+total+note · reprint. */
function BillRow({ sale }: { sale: CustomerSale }) {
  return (
    <tr>
      <td style={{ whiteSpace: "nowrap", verticalAlign: "top" }}>
        <div style={tableText.body2}>{new Date(sale.createdAt).toLocaleDateString("th-TH")}</div>
        <div style={{ ...tableText.subtitle, fontFamily: "var(--font-mono, monospace)" }}>
          {sale.saleNumber ?? "—"}
        </div>
      </td>
      <td style={{ verticalAlign: "top" }}>
        {/* Two columns: [item + its part ID inline] · [price]. The ID trails each name in faint
            mono — the exact part installed (same-brand parts interchange across car models). */}
        {sale.lines.length === 0 ? (
          <span className="muted">No items.</span>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr max-content",
              columnGap: 14,
              rowGap: 4,
              alignItems: "baseline",
            }}
          >
            {sale.lines.map((l, i) => (
              <Fragment key={i}>
                <span style={tableText.body2}>
                  {l.description || (l.lineType === "service" ? "Service" : "Item")}
                  {l.quantity > 1 && <span className="muted"> ×{l.quantity}</span>}
                  {l.productRef && (
                    <span
                      style={{
                        ...tableText.subtitle,
                        fontFamily: "var(--font-mono, monospace)",
                        marginLeft: 8,
                      }}
                    >
                      {l.productRef}
                    </span>
                  )}
                </span>
                <span style={{ ...tableText.body2, ...num, textAlign: "right" }}>
                  {formatBahtTrim(lineTotal(l))}
                </span>
              </Fragment>
            ))}
          </div>
        )}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            marginTop: 6,
            paddingTop: 6,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {sale.discountTotalSatang > 0 && (
            <div style={{ ...rowBetween, ...tableText.subtitle }}>
              <span>Discount</span>
              <span style={num}>−{formatBahtTrim(sale.discountTotalSatang)}</span>
            </div>
          )}
          <div style={{ ...rowBetween, ...tableText.body2, fontWeight: 500 }}>
            <span>Total</span>
            <span style={num}>{formatBahtTrim(sale.grandTotalSatang)}</span>
          </div>
          {sale.notes && (
            <div style={{ ...tableText.subtitle, marginTop: 2 }}>Note — {sale.notes}</div>
          )}
        </div>
      </td>
      <td style={{ ...right, whiteSpace: "nowrap", verticalAlign: "top" }}>
        <button
          type="button"
          className="btn-sm"
          onClick={() => {
            window.location.href = `/pos?reprint=${encodeURIComponent(sale.id)}`;
          }}
        >
          🖨 Reprint
        </button>
      </td>
    </tr>
  );
}

/** A transcribed old-book record on the same timeline: real old date + free-text work done. */
function LegacyRow({ entry }: { entry: CustomerLegacyEntry }) {
  return (
    <tr>
      <td style={{ whiteSpace: "nowrap", verticalAlign: "top" }}>
        <div style={tableText.body2}>{new Date(entry.happenedAt).toLocaleDateString("th-TH")}</div>
        <div style={tableText.subtitle}>legacy</div>
      </td>
      <td style={{ verticalAlign: "top" }}>
        <div style={{ ...tableText.body2, whiteSpace: "pre-wrap" }}>{entry.description}</div>
      </td>
      <td />
    </tr>
  );
}

/** A framed Date · Items · Action table: Kira bills merged with legacy records, newest first. */
function BillTable({
  sales,
  legacy = [],
}: {
  sales: CustomerSale[];
  legacy?: CustomerLegacyEntry[];
}) {
  const rows = [
    ...sales.map((s) => ({
      at: s.createdAt,
      key: `s-${s.id}`,
      sale: s,
      entry: null as CustomerLegacyEntry | null,
    })),
    ...legacy.map((e) => ({
      at: e.happenedAt,
      key: `l-${e.id}`,
      sale: null as CustomerSale | null,
      entry: e,
    })),
  ].sort((a, b) => b.at - a.at);
  return (
    <TableFrame>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Items</th>
            <th style={right}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            r.sale ? (
              <BillRow key={r.key} sale={r.sale} />
            ) : (
              <LegacyRow key={r.key} entry={r.entry!} />
            ),
          )}
        </tbody>
      </table>
    </TableFrame>
  );
}

export default function CustomersPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [list, setList] = useState<CustomerListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<{ name: string; phone: string; note: string }>({
    name: "",
    phone: "",
    note: "",
  });
  const [editing, setEditing] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Import (legacy customer Excel / service-history sheet) ──
  const [imp, setImp] = useState<{
    fileName: string;
    kind: "customers" | "history" | "combined" | "rich";
    rows: string[][];
    mapping: Record<string, string>;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [impResult, setImpResult] = useState<CustomerImportResult | null>(null);
  const [impHistoryResult, setImpHistoryResult] = useState<HistoryImportResult | null>(null);
  const [impCombined, setImpCombined] = useState<{
    cust: CustomerImportResult | null;
    hist: HistoryImportResult | null;
    errors: { rowIndex: number; reason: string }[];
  } | null>(null);
  const readingFile = useRef(false); // guard: an earlier slow parse must not clobber a newer pick
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked
    if (!file || readingFile.current) return;
    readingFile.current = true;
    try {
      const rows = /\.xlsx$/i.test(file.name)
        ? await xlsxToRows(new Uint8Array(await file.arrayBuffer()))
        : parseCsv(await file.text());
      if (rows.length < 2) {
        toast("That file has no data rows.", "error");
        return;
      }
      setImpResult(null);
      setImpHistoryResult(null);
      setImpCombined(null);
      // One button, several shapes. Check the rich grouped form FIRST (its data is behind a
      // title/group preamble, so rows[0] is not a header); then combined, then the simple tabs.
      const header = rows[0] ?? [];
      const kind = looksLikeRichSheet(rows)
        ? "rich"
        : looksLikeCombinedSheet(header)
          ? "combined"
          : looksLikeHistorySheet(header)
            ? "history"
            : "customers";
      setImp({
        fileName: file.name,
        kind,
        rows,
        mapping:
          kind === "history"
            ? guessHistoryMapping(header)
            : kind === "customers"
              ? guessCustomerMapping(header)
              : {},
      });
    } catch (err) {
      toast(`Couldn't read ${file.name}: ${(err as Error).message}`, "error");
    } finally {
      readingFile.current = false;
    }
  }

  function setImportField(field: string, header: string) {
    if (!imp) return;
    const mapping = { ...imp.mapping };
    if (header === "") delete mapping[field];
    else mapping[field] = header;
    setImp({ ...imp, mapping });
  }

  const historyReady =
    imp?.kind === "history" &&
    imp.mapping["license_plate"] != null &&
    imp.mapping["happened_at"] != null &&
    imp.mapping["description"] != null;
  const importReady =
    imp?.kind === "combined" || imp?.kind === "rich"
      ? true
      : imp?.kind === "history"
        ? historyReady
        : !!imp?.mapping["license_plate"];

  async function runImport() {
    if (!imp || !importReady) return;
    setImporting(true);
    try {
      if (imp.kind === "combined" || imp.kind === "rich") {
        const split = imp.kind === "rich" ? parseRichSheet(imp.rows) : splitCombinedSheet(imp.rows);
        const cust =
          split.customers.length > 1
            ? await importCustomersCsv(rowsToCsv(split.customers), CUST_TEMPLATE_MAPPING)
            : null;
        const hist =
          split.history.length > 1
            ? await importCustomerHistoryCsv(rowsToCsv(split.history), HIST_TEMPLATE_MAPPING)
            : null;
        // server errors refer to the GENERATED history csv — translate to the sheet's row numbers
        const histErrors = (hist?.errors ?? []).map((e) => ({
          rowIndex: split.historySourceRows[e.rowIndex - 1] ?? e.rowIndex,
          reason: e.reason,
        }));
        setImpCombined({ cust, hist, errors: [...split.errors, ...histErrors] });
        toast(
          `Imported ${(cust?.created ?? 0) + (cust?.updated ?? 0)} customers · ${hist?.imported ?? 0} history records`,
          "success",
        );
      } else if (imp.kind === "history") {
        const out = await importCustomerHistoryCsv(rowsToCsv(imp.rows), imp.mapping);
        setImpHistoryResult(out);
        toast(`Imported ${out.imported} history records`, "success");
      } else {
        const out = await importCustomersCsv(rowsToCsv(imp.rows), imp.mapping);
        setImpResult(out);
        toast(
          `Imported ${out.created + out.updated} customers — ${out.created} new · ${out.updated} updated`,
          "success",
        );
      }
      setList(await searchCustomers(q));
    } catch {
      toast("Import failed.", "error");
    } finally {
      setImporting(false);
    }
  }

  // ── Add customer (single walk-in record; bulk entry belongs in the Sheet + Import) ──
  const [showAdd, setShowAdd] = useState(false);
  const [add, setAdd] = useState({
    plate: "",
    province: "",
    name: "",
    phone: "",
    carModel: "",
    notes: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  async function saveNewCustomer() {
    const plate = add.plate.trim();
    if (!plate) return;
    setAddSaving(true);
    try {
      // Empty fields go as undefined (dropped from JSON): saving a plate that already exists
      // must never blank data someone typed earlier ("" would clear via the API's contract).
      const nn = (v: string) => (v.trim() ? v.trim() : undefined);
      await saveCustomer({
        licensePlate: plate,
        plateProvince: nn(add.province),
        customerName: nn(add.name),
        phone: nn(add.phone),
        carModel: nn(add.carModel),
        notes: nn(add.notes),
      });
      toast("Customer saved ✓", "success");
      setShowAdd(false);
      setAdd({ plate: "", province: "", name: "", phone: "", carModel: "", notes: "" });
      openCar(plate);
    } catch {
      toast("Couldn't save.", "error");
    } finally {
      setAddSaving(false);
    }
  }

  useEffect(() => {
    if (selected !== null) return; // detail view is showing; re-fetch when we return to the list
    const t = setTimeout(async () => {
      try {
        setList(await searchCustomers(q));
      } catch {
        toast("Couldn't load customers.", "error");
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, selected]);

  // Deep-link: /customers?plate=… opens that car directly (e.g. a sale's "View" action).
  useEffect(() => {
    const plate = new URLSearchParams(window.location.search).get("plate");
    if (plate) openCar(plate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openCar(plate: string) {
    setSelected(plate);
    setDetail(null);
    try {
      const d = await getCustomerDetail(plate);
      setDetail(d);
      const nm = d.customer?.customerName ?? "";
      const ph = d.customer?.phone ?? "";
      const nt = d.customer?.notes ?? "";
      setName(nm);
      setPhone(ph);
      setNote(nt);
      setSaved({ name: nm, phone: ph, note: nt });
      setEditing(false);
      setShowNotes(false);
    } catch {
      toast("Couldn't load this car.", "error");
    }
  }

  function startEdit() {
    setName(saved.name);
    setPhone(saved.phone);
    setNote(saved.note);
    setEditing(true);
  }

  function cancelEdit() {
    setName(saved.name);
    setPhone(saved.phone);
    setNote(saved.note);
    setEditing(false);
  }

  async function saveInfo() {
    if (!selected) return;
    setSaving(true);
    try {
      const nm = name.trim();
      const ph = phone.trim();
      const nt = note.trim();
      // Send the (possibly empty) strings, not null: the API COALESCEs, so "" clears a field
      // while an omitted field (e.g. from a POS partial upsert) stays preserved.
      await saveCustomer({
        licensePlate: selected,
        customerName: nm,
        phone: ph,
        notes: nt,
      });
      setSaved({ name: nm, phone: ph, note: nt });
      setName(nm);
      setPhone(ph);
      setNote(nt);
      setEditing(false);
      toast("Saved ✓", "success");
    } catch {
      toast("Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Detail view: one car ──
  if (selected) {
    const carLabel = detail?.vehicle || detail?.customer?.carModel || "";
    // Province is captured on the bill/POS flow and stored on the customer — shown read-only here.
    const prov = detail?.customer?.plateProvince?.trim();
    // Headline: full plate (number + province) · vehicle — e.g. "6ฉฉ2345 สุรินทร์ · Honda Jazz 2014".
    const headline = [selected + (prov ? ` ${prov}` : ""), carLabel].filter(Boolean).join(" · ");
    return (
      <main>
        <PageHeader
          title={headline}
          below={<BackLink onClick={() => setSelected(null)}>All customers</BackLink>}
        />

        <div style={{ ...frame, marginBottom: 24 }}>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={tableText.subtitle}>Customer name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="—"
                    style={{ ...inputS, width: 220 }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={tableText.subtitle}>Phone</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="—"
                    style={{ ...inputS, width: 180 }}
                  />
                </label>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={tableText.subtitle}>Notes</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Notes about this customer…"
                  rows={3}
                  style={{ ...inputS, width: "100%", resize: "vertical" }}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={cancelEdit} disabled={saving} style={inputS}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={saveInfo}
                  disabled={saving}
                  style={inputS}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={tableText.subtitle}>Customer name</span>
                  <span style={tableText.body2}>{saved.name || "—"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={tableText.subtitle}>Phone</span>
                  <span style={tableText.body2}>{saved.phone || "—"}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  <button type="button" onClick={() => setShowNotes((v) => !v)} style={inputS}>
                    {showNotes ? "Hide notes" : "Notes"}
                  </button>
                  <button type="button" className="btn-primary" onClick={startEdit} style={inputS}>
                    Edit
                  </button>
                </div>
              </div>
              {showNotes && (
                <div
                  style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}
                >
                  <div style={tableText.subtitle}>Notes</div>
                  <div style={{ ...tableText.body2, marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {saved.note || <span className="muted">No notes yet.</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {detail && detail.quotations.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Open quotations</h2>
            <BillTable sales={detail.quotations} />
          </div>
        )}

        <div>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Purchase &amp; repair history</h2>
          {!detail ? (
            <p className="muted">Loading…</p>
          ) : detail.history.length + (detail.legacy?.length ?? 0) === 0 ? (
            <div className="empty">
              <div className="empty-icon">🧾</div>No bills yet for this car.
            </div>
          ) : (
            <BillTable sales={detail.history} legacy={detail.legacy ?? []} />
          )}
        </div>
      </main>
    );
  }

  // ── List view: all cars ──
  const panelFields = imp?.kind === "history" ? CUSTOMER_HISTORY_FIELDS : CUSTOMER_IMPORT_FIELDS;
  const mappedFields = panelFields.filter((f) => imp?.mapping[f.field]);
  const headerIndexOf = (field: string) => (imp ? imp.rows[0]!.indexOf(imp.mapping[field]!) : -1);
  return (
    <main>
      <PageHeader
        title="Customers"
        subtitle="Find a car by plate, phone, or model to see its full service history."
      />
      {/* A real <button> (not a label) so it gets the app's button styling; it drives the
          hidden file input via ref. */}
      <div style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button type="button" className="btn-soft btn-sm" onClick={() => setShowAdd((v) => !v)}>
          Add customer
        </button>
        <button
          type="button"
          className="btn-soft btn-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          Import
        </button>
        <small className="muted">.xlsx or .csv — customer list or service-history file</small>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={onImportFile}
          style={{ display: "none" }}
        />
      </div>
      {showAdd && (
        <div style={{ ...frame, marginBottom: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            {(
              [
                ["License plate *", "plate", 160],
                ["Province", "province", 170],
                ["Name", "name", 200],
                ["Phone", "phone", 160],
                ["Car model", "carModel", 180],
                ["Notes", "notes", 220],
              ] as const
            ).map(([label, field, width]) => (
              <label key={field} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={tableText.subtitle}>{label}</span>
                <input
                  value={add[field]}
                  onChange={(e) => setAdd({ ...add, [field]: e.target.value })}
                  list={field === "province" ? "add-province-options" : undefined}
                  style={{ ...inputS, width }}
                />
              </label>
            ))}
            <datalist id="add-province-options">
              {THAI_PROVINCES.map((pv) => (
                <option key={pv} value={pv} />
              ))}
            </datalist>
            <button
              type="button"
              className="btn-primary"
              onClick={saveNewCustomer}
              disabled={addSaving || !add.plate.trim()}
              style={inputS}
            >
              {addSaving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} style={inputS}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {imp && (
        <div style={{ ...frame, marginBottom: 24 }}>
          <div style={{ ...rowBetween, alignItems: "baseline" }}>
            <div>
              <div style={{ ...tableText.body1, fontWeight: 600 }}>
                Import {imp.fileName}
                {imp.kind === "history" && " — service history"}
                {imp.kind === "combined" && " — customers + history (one block per car)"}
                {imp.kind === "rich" && " — customer form (info + visit history)"}
                {/* auto-detection can misfire (e.g. a customer list with a date column) — let the user flip it */}
                {imp.kind !== "combined" && imp.kind !== "rich" && (
                  <button
                    type="button"
                    className="btn-sm"
                    style={{ marginLeft: 10, minHeight: 0, padding: "2px 8px" }}
                    onClick={() => {
                      const kind = imp.kind === "history" ? "customers" : "history";
                      setImpResult(null);
                      setImpHistoryResult(null);
                      setImp({
                        ...imp,
                        kind,
                        mapping:
                          kind === "history"
                            ? guessHistoryMapping(imp.rows[0] ?? [])
                            : guessCustomerMapping(imp.rows[0] ?? []),
                      });
                    }}
                  >
                    {imp.kind === "history" ? "Treat as customer list" : "Treat as service history"}
                  </button>
                )}
              </div>
              <div style={{ ...tableText.subtitle, marginTop: 2 }}>
                {imp.rows.length - 1} data rows — match each field to a column, check the preview,
                then import. Re-importing is safe:{" "}
                {imp.kind === "combined" || imp.kind === "rich"
                  ? "cars and their visit history import together; re-importing is safe on both."
                  : imp.kind === "history"
                    ? "records already imported are skipped; nothing touches stock or sales."
                    : "existing cars are updated, empty cells never erase saved info."}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setImp(null);
                setImpResult(null);
                setImpHistoryResult(null);
                setImpCombined(null);
              }}
              style={inputS}
            >
              {impResult || impHistoryResult || impCombined ? "Close" : "Cancel"}
            </button>
          </div>
          {(imp.kind === "combined" || imp.kind === "rich") &&
            (() => {
              const split =
                imp.kind === "rich" ? parseRichSheet(imp.rows) : splitCombinedSheet(imp.rows);
              const unit = imp.kind === "rich" ? "visits" : "history lines";
              return (
                <div style={{ ...tableText.body2, marginTop: 14 }}>
                  Found <strong>{split.customers.length - 1}</strong> cars ·{" "}
                  <strong>{split.history.length - 1}</strong> {unit}
                  {split.errors.length > 0 && (
                    <span style={{ color: "var(--danger)" }}>
                      {" "}
                      · {split.errors.length} problem row(s) — they will be skipped
                    </span>
                  )}
                </div>
              );
            })()}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
            {imp.kind !== "combined" &&
              imp.kind !== "rich" &&
              panelFields.map((f) => (
                <label key={f.field} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={tableText.subtitle}>
                    {f.label}
                    {(f.field === "license_plate" || imp.kind === "history") && " *"}
                  </span>
                  <select
                    value={imp.mapping[f.field] ?? ""}
                    onChange={(e) => setImportField(f.field, e.target.value)}
                    style={{ ...inputS, width: 160 }}
                  >
                    <option value="">— skip —</option>
                    {/* key includes the index — a hand-made Excel can repeat a header name */}
                    {imp.rows[0]!.filter((h) => h.trim() !== "").map((h, i) => (
                      <option key={`${i}:${h}`} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
          </div>
          {mappedFields.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    {mappedFields.map((f) => (
                      <th key={f.field}>{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {imp.rows.slice(1, 6).map((row, r) => (
                    <tr key={r}>
                      {mappedFields.map((f) => (
                        <td key={f.field} style={tableText.body2}>
                          {row[headerIndexOf(f.field)] || <span className="muted">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {imp.rows.length > 6 && (
                <div style={{ ...tableText.subtitle, marginTop: 6 }}>
                  …and {imp.rows.length - 6} more rows.
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={runImport}
              disabled={importing || !importReady}
              style={inputS}
            >
              {importing ? "Importing…" : `Import ${imp.rows.length - 1} rows`}
            </button>
            {!importReady && (
              <span style={tableText.subtitle}>
                {imp.kind === "history"
                  ? "Map plate, date, and work columns first."
                  : "Pick the license-plate column first."}
              </span>
            )}
            {impResult && (
              <span style={tableText.body2}>
                Received <strong>{impResult.received}</strong> · new{" "}
                <strong>{impResult.created}</strong> · updated <strong>{impResult.updated}</strong>{" "}
                · duplicates <strong>{impResult.duplicates}</strong> · skipped{" "}
                <strong>{impResult.invalid}</strong>
              </span>
            )}
            {impHistoryResult && (
              <span style={tableText.body2}>
                Received <strong>{impHistoryResult.received}</strong> · imported{" "}
                <strong>{impHistoryResult.imported}</strong> · duplicates{" "}
                <strong>{impHistoryResult.duplicates}</strong> · skipped{" "}
                <strong>{impHistoryResult.invalid}</strong>
              </span>
            )}
            {impCombined && (
              <span style={tableText.body2}>
                Cars: <strong>{impCombined.cust?.created ?? 0}</strong> new ·{" "}
                <strong>{impCombined.cust?.updated ?? 0}</strong> updated — History:{" "}
                <strong>{impCombined.hist?.imported ?? 0}</strong> imported ·{" "}
                <strong>{impCombined.hist?.duplicates ?? 0}</strong> duplicates ·{" "}
                <strong>{impCombined.errors.length}</strong> skipped
              </span>
            )}
          </div>
          {(() => {
            const errs = impResult?.errors ?? impHistoryResult?.errors ?? impCombined?.errors ?? [];
            return errs.length > 0 ? (
              <div style={{ ...tableText.subtitle, marginTop: 8 }}>
                {errs.slice(0, 5).map((er) => (
                  <div key={er.rowIndex}>
                    Row {er.rowIndex}: {er.reason}
                  </div>
                ))}
                {errs.length > 5 && <div>…and {errs.length - 5} more skipped rows.</div>}
              </div>
            ) : null;
          })()}
        </div>
      )}
      <div style={frame}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search plate, phone, or car…"
          style={{ ...inputS, width: 280, maxWidth: "100%", marginBottom: 12 }}
        />
        {list.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👥</div>
            {q
              ? "No matching cars."
              : "No customers yet — they appear after their first bill, or import your customer Excel."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Car</th>
                  <th>Plate</th>
                  <th>Customer</th>
                  <th>Visits</th>
                  <th>Last visit</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  // Billed cars carry the bill's vehicle label; imported ones only the directory's
                  // car model — show whichever exists.
                  const car = c.vehicle ?? c.carModel ?? "";
                  const model = stripCarYear(car);
                  const year = carYearOf(car);
                  return (
                    <tr
                      key={c.licensePlate}
                      style={{ cursor: "pointer" }}
                      onClick={() => openCar(c.licensePlate)}
                    >
                      <td>
                        <div style={tableText.body2}>
                          {model || <span className="muted">—</span>}
                        </div>
                        {year && <div style={tableText.subtitle}>{year}</div>}
                      </td>
                      <td style={{ ...tableText.body1, whiteSpace: "nowrap" }}>{c.licensePlate}</td>
                      <td>
                        <div style={tableText.body2}>
                          {c.customerName || <span className="muted">—</span>}
                        </div>
                        {c.phone && <div style={tableText.subtitle}>{c.phone}</div>}
                      </td>
                      <td>{c.billCount}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {c.lastVisitAt != null ? (
                          new Date(c.lastVisitAt).toLocaleDateString("th-TH")
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
