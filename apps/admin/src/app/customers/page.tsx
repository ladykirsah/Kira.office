"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../PageHeader";
import {
  searchCustomers,
  getCustomerDetail,
  saveCustomer,
  type CustomerListItem,
  type CustomerDetail,
  type CustomerSaleLine,
} from "@/lib/api";
import { formatBaht } from "@/lib/format";
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
                  {detail.history.map((s) => (
                    <tr key={s.id}>
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
                        style={{ fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap" }}
                      >
                        {s.saleNumber ?? "—"}
                      </td>
                      <td>{itemsSummary(s.lines)}</td>
                      <td style={tableText.subtitle}>{s.notes || "—"}</td>
                      <td>{formatBaht(s.grandTotalSatang)}</td>
                    </tr>
                  ))}
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
                  <th>Plate</th>
                  <th>Customer</th>
                  <th>Visits</th>
                  <th>Last visit</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr
                    key={c.licensePlate}
                    style={{ cursor: "pointer" }}
                    onClick={() => openCar(c.licensePlate)}
                  >
                    <td>
                      <div style={tableText.body2}>{c.licensePlate}</div>
                      {c.vehicle && <div style={tableText.subtitle}>{c.vehicle}</div>}
                    </td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
