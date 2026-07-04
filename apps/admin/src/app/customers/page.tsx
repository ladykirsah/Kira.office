"use client";

import { Fragment, useEffect, useState } from "react";
import { PageHeader } from "../PageHeader";
import {
  searchCustomers,
  getCustomerDetail,
  saveCustomer,
  getOnsiteSale,
  type CustomerListItem,
  type CustomerDetail,
  type CustomerSaleLine,
  type FullBill,
  type FullBillLine,
} from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { stripCarYear, carYearOf } from "@/lib/badges";
import { inputS } from "@/lib/inputStyles";
import { tableText } from "@/lib/tableText";
import { useToast } from "../ToastProvider";

const frame = { border: "1px solid var(--border)", borderRadius: 8, padding: 18 } as const;

/** "Regas, Filter drier ×2" — a one-line items summary for a bill/quotation row. */
function itemsSummary(lines: CustomerSaleLine[]): string {
  if (!lines.length) return "—";
  return lines
    .map((l) => `${l.description ?? "item"}${l.quantity > 1 ? ` ×${l.quantity}` : ""}`)
    .join(", ");
}

const right = { textAlign: "right" } as const;
const lineTotal = (l: FullBillLine) => l.unitPriceSatang * l.quantity - l.discountSatang;

/** The full-track detail of one bill: every line, per-line price/total, the discount, total + note. */
function BillDetailPanel({ bill }: { bill: FullBill | null }) {
  if (!bill) {
    return (
      <p className="muted" style={{ padding: 14, margin: 0 }}>
        Loading…
      </p>
    );
  }
  return (
    <div style={{ padding: 14 }}>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style={right}>Qty</th>
              <th style={right}>Unit</th>
              <th style={right}>Total</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.description || (l.lineType === "service" ? "Service" : "Item")}</td>
                <td style={right}>{l.quantity}</td>
                <td style={right}>{formatBaht(l.unitPriceSatang)}</td>
                <td style={right}>{formatBaht(lineTotal(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          alignItems: "flex-end",
          marginTop: 10,
        }}
      >
        <div style={tableText.subtitle}>Subtotal {formatBaht(bill.subtotalSatang)}</div>
        {bill.discountTotalSatang > 0 && (
          <div style={tableText.subtitle}>Discount −{formatBaht(bill.discountTotalSatang)}</div>
        )}
        {bill.taxTotalSatang > 0 && (
          <div style={tableText.subtitle}>VAT {formatBaht(bill.taxTotalSatang)}</div>
        )}
        <div style={{ ...tableText.body1, fontWeight: 700 }}>
          Total {formatBaht(bill.grandTotalSatang)}
        </div>
      </div>
      {bill.notes && <div style={{ marginTop: 8, ...tableText.subtitle }}>Note: {bill.notes}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <a className="btn-primary" href={`/pos?reprint=${encodeURIComponent(bill.id)}`}>
          🖨 Preview &amp; reprint
        </a>
      </div>
    </div>
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
  const [saving, setSaving] = useState(false);
  const [openBill, setOpenBill] = useState<string | null>(null);
  const [billDetail, setBillDetail] = useState<FullBill | null>(null);

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
    setOpenBill(null);
    try {
      const d = await getCustomerDetail(plate);
      setDetail(d);
      setName(d.customer?.customerName ?? "");
      setPhone(d.customer?.phone ?? "");
    } catch {
      toast("Couldn't load this car.", "error");
    }
  }

  async function toggleBill(id: string) {
    if (openBill === id) {
      setOpenBill(null);
      return;
    }
    setOpenBill(id);
    setBillDetail(null);
    try {
      setBillDetail(await getOnsiteSale(id));
    } catch {
      toast("Couldn't load the bill.", "error");
    }
  }

  async function saveInfo() {
    if (!selected) return;
    setSaving(true);
    try {
      await saveCustomer({
        licensePlate: selected,
        customerName: name.trim() || null,
        phone: phone.trim() || null,
      });
      toast("Saved ✓", "success");
    } catch {
      toast("Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Detail view: one car ──
  if (selected) {
    return (
      <main>
        <PageHeader
          title={selected}
          subtitle={detail?.vehicle || detail?.customer?.carModel || "On-site customer"}
          action={
            <button type="button" className="btn-soft" onClick={() => setSelected(null)}>
              ← All customers
            </button>
          }
        />

        <div style={{ ...frame, marginBottom: 20 }}>
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

        {detail && detail.quotations.length > 0 && (
          <div style={{ ...frame, marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Open quotations</h2>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Quotation</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.quotations.map((s) => (
                    <tr key={s.id}>
                      <td
                        style={{ fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap" }}
                      >
                        {s.saleNumber ?? "—"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {new Date(s.createdAt).toLocaleDateString("th-TH")}
                      </td>
                      <td>{itemsSummary(s.lines)}</td>
                      <td>{formatBaht(s.grandTotalSatang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={frame}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Purchase &amp; repair history</h2>
          {!detail ? (
            <p className="muted">Loading…</p>
          ) : detail.history.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🧾</div>No bills yet for this car.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bill</th>
                    <th>Items</th>
                    <th>Note</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.history.map((s) => {
                    const open = openBill === s.id;
                    return (
                      <Fragment key={s.id}>
                        <tr style={{ cursor: "pointer" }} onClick={() => toggleBill(s.id)}>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <div style={tableText.body2}>
                              {new Date(s.createdAt).toLocaleDateString("th-TH")}
                            </div>
                            <div style={tableText.subtitle}>
                              {new Date(s.createdAt).toLocaleTimeString("th-TH", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>
                          <td
                            style={{
                              fontFamily: "var(--font-mono, monospace)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {open ? "▾ " : "▸ "}
                            {s.saleNumber ?? "—"}
                          </td>
                          <td>{itemsSummary(s.lines)}</td>
                          <td style={tableText.subtitle}>{s.notes || "—"}</td>
                          <td>{formatBaht(s.grandTotalSatang)}</td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={5} style={{ padding: 0, background: "var(--bg)" }}>
                              <BillDetailPanel bill={billDetail} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
