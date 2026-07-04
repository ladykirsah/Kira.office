"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchShopInfo,
  fetchPayments,
  recordPayment,
  clearPayments,
  type PaymentRow,
} from "@/lib/api";
import { parsePaymentMethods, defaultPaymentMethod, type PaymentMethod } from "@l-shopee/core";
import { formatBahtTrim, formatUpdatedAt } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { inputL } from "@/lib/inputStyles";
import { PromptPayQr } from "../pos/PromptPayQr";
import { ConfirmButton } from "../ConfirmButton";
import { PageHeader } from "../PageHeader";
import { TableFrame } from "../TableFrame";
import { useToast } from "../ToastProvider";

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "18px 20px",
};
const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
};

/**
 * The official take-payment flow (owner works off-site; staff run the counter): pick the receiving
 * PromptPay account (configured in Shop info, default preselected), enter the amount, CREATE the QR,
 * let the customer scan, then APPROVE once their banking app confirms. Every approval is recorded so
 * the owner can reconcile against the receiving bank account — the record is the anti-cheat.
 * The QR is snapshotted on Create so a later input edit can't desync the shown amount from Approve.
 * Recent payments are internal reconciliation info, hidden behind a toggle. Auto-confirmation (slip
 * verification / gateway) plugs in later via the payments.status field.
 */
export default function PaymentPage() {
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState(""); // THB text input; satang derived below
  const [qr, setQr] = useState<{ method: PaymentMethod; amountSatang: number } | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [showRecent, setShowRecent] = useState(false); // Section 2 is internal — hidden by default
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchShopInfo()
      .then((s) => {
        const list = parsePaymentMethods(s.paymentMethods);
        setMethods(list);
        setMethodId(defaultPaymentMethod(list)?.id ?? "");
      })
      .catch((e) => setError((e as Error).message));
    fetchPayments()
      .then(setPayments)
      .catch((e) => setError((e as Error).message));
  }, []);

  const method = methods.find((m) => m.id === methodId) ?? null;
  const amountSatang = useMemo(() => {
    const n = Number(amount.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
  }, [amount]);
  const nameOf = (m: PaymentMethod) => m.position || m.label;

  function createQr() {
    if (!method || amountSatang == null) return;
    setQr({ method, amountSatang });
  }

  async function approve() {
    if (!qr) return;
    setBusy(true);
    try {
      await recordPayment({
        methodLabel: qr.method.label,
        promptpayId: qr.method.promptpayId,
        amountSatang: qr.amountSatang,
      });
      toast(
        `Payment approved — ${formatBahtTrim(qr.amountSatang)} → ${qr.method.label}`,
        "success",
      );
      setQr(null);
      setAmount("");
      setPayments(await fetchPayments()); // keep the (hidden) list fresh
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      const { cleared } = await clearPayments();
      toast(`Cleared ${cleared} payment(s) — records kept for reconciliation`, "success");
      setPayments(await fetchPayments());
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <main>
        <h1>Payment</h1>
        <p style={{ color: "var(--danger)" }}>{error}</p>
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        title="Payment"
        subtitle="Take a PromptPay payment: pick the receiving account, enter the amount, create the QR, let the customer scan, then approve once their banking app confirms."
      />

      {methods.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">💳</div>
          No PromptPay accounts yet — add them in Shop info → Payment.
        </div>
      ) : (
        <>
          {/* ── Section 1 · Payment & QR — two separate frames, each sizing to its content ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 20,
              alignItems: "start", // each frame is only as tall as its own content
            }}
          >
            {/* Frame 1 — enter the payment */}
            <div style={card}>
              <div style={fieldLabel}>PAY TO</div>
              <select
                value={methodId}
                onChange={(e) => {
                  setMethodId(e.target.value);
                  setQr(null); // a new account invalidates the shown QR
                }}
                style={{ ...inputL, width: "100%", marginTop: 6 }}
                aria-label="Payment method"
              >
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {nameOf(m)}
                    {m.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>

              <div style={{ ...fieldLabel, marginTop: 16 }}>AMOUNT (฿)</div>
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                  setQr(null); // a changed amount invalidates the shown QR
                }}
                placeholder="0.00"
                inputMode="decimal"
                aria-label="Amount (baht)"
                style={{ ...inputL, width: "100%", marginTop: 6, fontSize: 22, fontWeight: 700 }}
              />

              <button
                type="button"
                className="btn-primary"
                onClick={createQr}
                disabled={!method || amountSatang == null}
                style={{ width: "100%", marginTop: 18 }}
              >
                Create QR code
              </button>
            </div>

            {/* Frame 2 — the created QR + approve */}
            <div
              style={{
                ...card,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              {qr ? (
                <>
                  <div className="muted" style={{ fontSize: 12 }}>
                    สแกนจ่ายผ่านพร้อมเพย์
                  </div>
                  <div style={{ fontWeight: 700, marginTop: 2, marginBottom: 12, fontSize: 16 }}>
                    {formatBahtTrim(qr.amountSatang)} → {qr.method.label}
                  </div>
                  <PromptPayQr
                    promptpayId={qr.method.promptpayId}
                    amountSatang={qr.amountSatang}
                    size={200}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={approve}
                    disabled={busy}
                    style={{ width: "100%", marginTop: 18 }}
                  >
                    ✓ Approve payment
                  </button>
                </>
              ) : (
                <div className="muted" style={{ fontSize: 13, padding: "24px 0" }}>
                  Enter the amount and press “Create QR code”.
                </div>
              )}
            </div>
          </div>

          {/* ── Section 2 · Recent payments (internal — hidden behind a toggle) ── */}
          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              className="btn-soft"
              onClick={() => setShowRecent((s) => !s)}
              aria-expanded={showRecent}
            >
              {showRecent ? "▾" : "▸"} Recent payments ({payments.length})
            </button>

            {showRecent &&
              (payments.length === 0 ? (
                <div className="empty" style={{ marginTop: 12 }}>
                  <div className="empty-icon">🧾</div>No payments recorded yet.
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  {/* Owner reconciliation: after checking the batch against the bank, Clear marks them
                      reconciled (kept in the DB) so the working list resets. */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                    <ConfirmButton
                      className="btn-soft btn-sm"
                      confirmLabel={`Clear all ${payments.length}?`}
                      onConfirm={clear}
                      disabled={busy}
                    >
                      Clear
                    </ConfirmButton>
                  </div>
                  <TableFrame>
                    <table>
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Account</th>
                          <th style={{ textAlign: "right" }}>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => {
                          const [date, time] = formatUpdatedAt(p.createdAt).split(" · ");
                          return (
                            <tr key={p.id}>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <div style={tableText.body2}>{date}</div>
                                <div style={tableText.subtitle}>{time}</div>
                              </td>
                              <td>
                                <div style={tableText.body2}>{p.methodLabel}</div>
                                <div style={tableText.subtitle}>{p.promptpayId}</div>
                              </td>
                              <td style={{ textAlign: "right", ...tableText.body2 }}>
                                {formatBahtTrim(p.amountSatang)}
                              </td>
                              <td>
                                <span
                                  className={`pill ${p.status === "approved" || p.status === "confirmed" ? "good" : p.status === "void" ? "bad" : "warn"}`}
                                >
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </TableFrame>
                </div>
              ))}
          </div>
        </>
      )}
    </main>
  );
}
