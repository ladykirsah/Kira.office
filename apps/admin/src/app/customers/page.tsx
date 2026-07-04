"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../PageHeader";
import {
  searchCustomers,
  getCustomerDetail,
  saveCustomer,
  type CustomerListItem,
  type CustomerDetail,
  type CustomerSale,
  type CustomerSaleLine,
} from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { stripCarYear, carYearOf } from "@/lib/badges";
import { inputS } from "@/lib/inputStyles";
import { tableText } from "@/lib/tableText";
import { useToast } from "../ToastProvider";

const frame = { border: "1px solid var(--border)", borderRadius: 8, padding: 18 } as const;
const billRow = { display: "flex", justifyContent: "space-between", gap: 16 } as const;
const mono = { fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap" } as const;
const lineTotal = (l: CustomerSaleLine) => l.unitPriceSatang * l.quantity - l.discountSatang;

/** One bill/quotation as a self-contained receipt card: full items + prices, discount, note, reprint. */
function BillCard({ sale }: { sale: CustomerSale }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={tableText.body2}>
          {new Date(sale.createdAt).toLocaleDateString("th-TH")} ·{" "}
          {new Date(sale.createdAt).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <div style={{ ...tableText.subtitle, fontFamily: "var(--font-mono, monospace)" }}>
          {sale.saleNumber ?? "—"}
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {sale.lines.length === 0 ? (
          <span className="muted">No items.</span>
        ) : (
          sale.lines.map((l, i) => (
            <div key={i} style={billRow}>
              <span>
                {l.description || (l.lineType === "service" ? "Service" : "Item")}
                {l.quantity > 1 && <span className="muted"> ×{l.quantity}</span>}
              </span>
              <span style={mono}>{formatBaht(lineTotal(l))}</span>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          marginTop: 10,
          paddingTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {sale.discountTotalSatang > 0 && (
          <>
            <div style={{ ...billRow, ...tableText.subtitle }}>
              <span>Subtotal</span>
              <span style={mono}>{formatBaht(sale.subtotalSatang)}</span>
            </div>
            <div style={{ ...billRow, ...tableText.subtitle }}>
              <span>Discount</span>
              <span style={mono}>−{formatBaht(sale.discountTotalSatang)}</span>
            </div>
          </>
        )}
        <div style={{ ...billRow, fontWeight: 500 }}>
          <span>Total</span>
          <span style={mono}>{formatBaht(sale.grandTotalSatang)}</span>
        </div>
        {sale.taxTotalSatang > 0 && (
          <div style={{ ...tableText.subtitle, textAlign: "right" }}>
            incl. VAT {formatBaht(sale.taxTotalSatang)}
          </div>
        )}
        {sale.notes && (
          <div style={{ ...tableText.subtitle, marginTop: 4 }}>Note — {sale.notes}</div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <a className="btn-soft" href={`/pos?reprint=${encodeURIComponent(sale.id)}`}>
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
      setName(d.customer?.customerName ?? "");
      setPhone(d.customer?.phone ?? "");
    } catch {
      toast("Couldn't load this car.", "error");
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

        <div style={{ ...frame, marginBottom: 24 }}>
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
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Open quotations</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {detail.quotations.map((s) => (
                <BillCard key={s.id} sale={s} />
              ))}
            </div>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {detail.history.map((s) => (
                <BillCard key={s.id} sale={s} />
              ))}
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
