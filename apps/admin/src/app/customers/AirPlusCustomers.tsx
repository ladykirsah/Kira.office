"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../PageHeader";
import { BackLink } from "../BackLink";
import { TableFrame } from "../TableFrame";
import {
  searchStorefrontCustomers,
  getStorefrontCustomerDetail,
  setStorefrontMarketingConsent,
  anonymizeStorefrontCustomer,
  type StorefrontCustomerListItem,
  type StorefrontCustomerDetail,
} from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import { tableText } from "@/lib/tableText";
import { useToast } from "../ToastProvider";

const frame = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 18,
  background: "var(--surface)",
} as const;

const date = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleDateString("th-TH") : "—";
const dateTime = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleString("th-TH") : "—";

/** The typed phrase that arms erasure — a click alone must never be enough for an irreversible act. */
const ERASE_CONFIRM = "ERASE";

function ConsentPill({ at, label }: { at: number | null; label: string }) {
  const given = at != null;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        border: "1px solid var(--border)",
        background: given ? "var(--ok-bg, #e8f5e9)" : "transparent",
        color: given ? "var(--ok-fg, #1b5e20)" : "var(--muted)",
      }}
      title={given ? `${label}: ${dateTime(at)}` : `${label}: no record`}
    >
      {label} {given ? `· ${date(at)}` : "· —"}
    </span>
  );
}

function Detail({
  id,
  onBack,
  onChanged,
}: {
  id: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<StorefrontCustomerDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [eraseText, setEraseText] = useState("");

  const load = useCallback(() => {
    getStorefrontCustomerDetail(id)
      .then(setData)
      .catch((e: unknown) => toast(e instanceof Error ? e.message : "Load failed", "error"));
  }, [id, toast]);
  useEffect(load, [load]);

  const c = data?.customer;
  const erased = c?.anonymizedAt != null;

  async function toggleMarketing(next: boolean) {
    setBusy(true);
    try {
      await setStorefrontMarketingConsent(id, next);
      toast(next ? "Marketing consent recorded" : "Marketing consent withdrawn", "success");
      load();
      onChanged();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    setBusy(true);
    try {
      await anonymizeStorefrontCustomer(id);
      toast("Customer data erased — their orders were kept", "success");
      setEraseText("");
      load();
      onChanged();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Erase failed", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!data || !c) {
    return (
      <main>
        <BackLink onClick={onBack}>All AirPlus customers</BackLink>
        <div className="muted" style={{ padding: 24 }}>
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main>
      <BackLink onClick={onBack}>All AirPlus customers</BackLink>
      <PageHeader title={c.name || "(no name yet)"} subtitle={c.phone} />

      <div style={{ ...frame, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          <Field label="User ID" value={c.customerCode ?? "—"} mono />
          <Field label="Account created" value={dateTime(c.createdAt)} />
          <Field label="Last login" value={dateTime(c.lastLoginAt)} />
          <Field label="Phone verified" value={date(c.phoneVerifiedAt)} />
          <Field label="Email" value={c.email ?? "—"} />
          <Field label="LINE" value={c.lineLinked ? "Linked" : "—"} />
          <Field label="Status" value={c.status} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <ConsentPill at={c.pdpaConsentAt} label="Privacy + terms" />
          <ConsentPill at={c.marketingConsentAt} label="Marketing" />
        </div>
      </div>

      {!erased && (
        <div style={{ ...frame, marginBottom: 16 }}>
          <strong style={tableText.body2}>Marketing consent</strong>
          <p className="muted" style={{ margin: "6px 0 12px", fontSize: 13 }}>
            Promotional LINE / SMS / email needs its own opt-in, separate from the privacy notice
            they accepted at sign-up. Only record it here if the customer actually agreed — the
            storefront does not ask for it yet.
          </p>
          <button
            type="button"
            className="btn-soft btn-sm"
            disabled={busy}
            onClick={() => toggleMarketing(c.marketingConsentAt == null)}
          >
            {c.marketingConsentAt == null ? "Record opt-in" : "Withdraw consent"}
          </button>
        </div>
      )}

      <h3 style={{ margin: "20px 0 10px" }}>Purchase history</h3>
      <TableFrame>
        {data.orders.length === 0 ? (
          <div className="muted" style={{ padding: 12 }}>
            No AirPlus orders yet.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Status</th>
                <th>Payment</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th>Tracking</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{date(o.orderCreatedAt)}</td>
                  <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{o.externalOrderId}</td>
                  <td>{o.orderStatus ?? "—"}</td>
                  <td>{o.paymentStatus ?? "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {formatBahtTrim(o.grandTotalSatang)}
                  </td>
                  <td>{o.trackingNo ? `${o.carrier ?? ""} ${o.trackingNo}`.trim() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableFrame>

      <h3 style={{ margin: "24px 0 10px" }}>PDPA erasure</h3>
      <div style={{ ...frame, borderColor: erased ? "var(--border)" : "var(--danger, #c62828)" }}>
        {erased ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Erased on {dateTime(c.anonymizedAt)}. Their orders were kept — the law requires us to
            retain tax records.
          </p>
        ) : (
          <>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
              Honours a &ldquo;delete my data&rdquo; request: blanks their name, phone, email and
              LINE link, and closes the account. Their orders stay, because tax records must be
              retained (Privacy Notice §5). <strong>This cannot be undone.</strong>
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                style={{ ...inputS, width: 200 }}
                placeholder={`Type ${ERASE_CONFIRM} to confirm`}
                value={eraseText}
                onChange={(e) => setEraseText(e.target.value)}
                aria-label={`Type ${ERASE_CONFIRM} to confirm erasure`}
              />
              <button
                type="button"
                className="btn-soft btn-sm"
                disabled={busy || eraseText !== ERASE_CONFIRM}
                onClick={erase}
              >
                Erase customer data
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={tableText.subtitle}>{label}</div>
      <div
        style={
          mono ? { ...tableText.body2, fontFamily: "var(--font-mono, monospace)" } : tableText.body2
        }
      >
        {value}
      </div>
    </div>
  );
}

export function AirPlusCustomers() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [list, setList] = useState<StorefrontCustomerListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (term: string) => {
      setLoading(true);
      searchStorefrontCustomers(term)
        .then(setList)
        .catch((e: unknown) => toast(e instanceof Error ? e.message : "Load failed", "error"))
        .finally(() => setLoading(false));
    },
    [toast],
  );

  // Debounced so typing a phone number doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  if (selected) {
    return <Detail id={selected} onBack={() => setSelected(null)} onChanged={() => load(q)} />;
  }

  return (
    <main>
      <PageHeader
        title="AirPlus customers"
        subtitle="Online shop accounts — sign-up date, consent, and what they've bought."
      />
      <div style={{ marginBottom: 12 }}>
        <input
          style={{ ...inputS, width: 320 }}
          placeholder="Search User ID, name, phone, or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search AirPlus customers by User ID, name, phone, or email"
        />
      </div>
      <TableFrame>
        {loading ? (
          <div className="muted" style={{ padding: 12 }}>
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div className="empty-icon">🛒</div>
            {q ? "No matching customers." : "No AirPlus accounts yet."}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Customer</th>
                <th>Signed up</th>
                <th>Consent</th>
                <th>Orders</th>
                <th style={{ textAlign: "right" }}>Spent</th>
                <th>Last order</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(c.id)}
                  title="Open customer"
                >
                  <td style={{ whiteSpace: "nowrap", fontFamily: "var(--font-mono, monospace)" }}>
                    {c.customerCode ?? "—"}
                  </td>
                  <td>
                    <div style={tableText.body2}>{c.name || "(no name yet)"}</div>
                    <div style={tableText.subtitle}>
                      {c.phone}
                      {c.lineLinked ? " · LINE" : ""}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{date(c.createdAt)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <ConsentPill at={c.marketingConsentAt} label="Marketing" />
                  </td>
                  <td>{c.orderCount}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {formatBahtTrim(c.spentSatang)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{date(c.lastOrderAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableFrame>
    </main>
  );
}
