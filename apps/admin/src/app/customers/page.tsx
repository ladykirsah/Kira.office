"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../PageHeader";
import { BackLink } from "../BackLink";
import { TableFrame } from "../TableFrame";
import {
  searchCustomers,
  getCustomerDetail,
  saveCustomer,
  type CustomerListItem,
  type CustomerDetail,
  type CustomerSale,
  type CustomerSaleLine,
} from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { stripCarYear, carYearOf } from "@/lib/badges";
import { inputS } from "@/lib/inputStyles";
import { tableText } from "@/lib/tableText";
import { useToast } from "../ToastProvider";

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
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sale.lines.length === 0 ? (
            <span className="muted">No items.</span>
          ) : (
            sale.lines.map((l, i) => (
              <div key={i} style={{ ...rowBetween, ...tableText.body2 }}>
                <span>
                  {l.description || (l.lineType === "service" ? "Service" : "Item")}
                  {l.quantity > 1 && <span className="muted"> ×{l.quantity}</span>}
                </span>
                <span style={num}>{formatBahtTrim(lineTotal(l))}</span>
              </div>
            ))
          )}
        </div>
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

/** A framed Date · Bill · Items · Action table of bills/quotations. */
function BillTable({ sales }: { sales: CustomerSale[] }) {
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
          {sales.map((s) => (
            <BillRow key={s.id} sale={s} />
          ))}
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
      await saveCustomer({
        licensePlate: selected,
        customerName: nm || null,
        phone: ph || null,
        notes: nt || null,
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
          ) : detail.history.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🧾</div>No bills yet for this car.
            </div>
          ) : (
            <BillTable sales={detail.history} />
          )}
        </div>
      </main>
    );
  }

  // ── List view: all cars ──
  return (
    <main>
      <PageHeader
        title="Customers"
        subtitle="Find a car by plate or phone to see its full service history."
      />
      <div style={frame}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search plate or phone…"
          style={{ ...inputS, width: 280, maxWidth: "100%", marginBottom: 12 }}
        />
        {list.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👥</div>
            {q
              ? "No matching cars."
              : "No customers yet — they appear here after their first bill."}
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
                  const model = stripCarYear(c.vehicle ?? "");
                  const year = carYearOf(c.vehicle ?? "");
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
                        {new Date(c.lastVisitAt).toLocaleDateString("th-TH")}
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
