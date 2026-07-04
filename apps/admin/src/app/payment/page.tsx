"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchShopInfo, fetchPayments, recordPayment, type PaymentRow } from "@/lib/api";
import { parsePaymentMethods, defaultPaymentMethod, type PaymentMethod } from "@l-shopee/core";
import { formatBahtTrim, formatUpdatedAt } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { inputL } from "@/lib/inputStyles";
import { PromptPayQr } from "../pos/PromptPayQr";
import { PageHeader } from "../PageHeader";
import { TableFrame } from "../TableFrame";
import { useToast } from "../ToastProvider";

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "18px 20px",
};

/**
 * The official take-payment flow (owner works off-site; staff run the counter): pick the receiving
 * PromptPay account (configured in Shop info, default preselected), type the amount, show the QR to
 * the customer, then APPROVE once their banking app confirms. Every approval is recorded so the
 * owner can reconcile against the receiving bank account — the record is the anti-cheat.
 * Auto-confirmation (slip verification / gateway) plugs in later via the payments.status field.
 */
export default function PaymentPage() {
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState(""); // THB text input; satang derived below
  const [payments, setPayments] = useState<PaymentRow[]>([]);
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

  async function approve() {
    if (!method || amountSatang == null) return;
    setBusy(true);
    try {
      await recordPayment({
        methodLabel: method.label,
        promptpayId: method.promptpayId,
        amountSatang,
      });
      toast(`Payment approved — ${formatBahtTrim(amountSatang)} → ${method.label}`, "success");
      setAmount("");
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
        subtitle="Take a PromptPay payment: pick the receiving account, enter the amount, let the customer scan, then approve once their banking app confirms. Every approval is recorded."
      />

      {methods.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">💳</div>
          No PromptPay accounts yet — add them in Shop info → Payment.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 420px) 1fr", gap: 20 }}>
          <div style={card}>
            {/* 1 · account */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>PAY TO</div>
            <select
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
              style={{ ...inputL, width: "100%", marginTop: 6 }}
              aria-label="Payment method"
            >
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.position ? `${m.position} · ` : ""}
                  {m.label} — {m.promptpayId}
                  {m.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>

            {/* 2 · amount */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                marginTop: 14,
              }}
            >
              AMOUNT (฿)
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              inputMode="decimal"
              aria-label="Amount (baht)"
              style={{ ...inputL, width: "100%", marginTop: 6, fontSize: 22, fontWeight: 700 }}
            />

            {/* 3 · QR appears once both are valid */}
            <div style={{ textAlign: "center", marginTop: 16, minHeight: 200 }}>
              {method && amountSatang != null ? (
                <>
                  <PromptPayQr
                    promptpayId={method.promptpayId}
                    amountSatang={amountSatang}
                    size={190}
                  />
                  <div style={{ fontWeight: 700, marginTop: 4 }}>
                    {formatBahtTrim(amountSatang)} → {method.label}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    สแกนจ่ายผ่านพร้อมเพย์
                  </div>
                </>
              ) : (
                <div className="muted" style={{ paddingTop: 70, fontSize: 13 }}>
                  Enter an amount to generate the QR
                </div>
              )}
            </div>

            {/* 4 · approve */}
            <button
              type="button"
              className="btn-primary"
              onClick={approve}
              disabled={busy || !method || amountSatang == null}
              style={{ width: "100%", marginTop: 14 }}
            >
              ✓ Approve payment
            </button>
          </div>

          <div>
            <h2 style={{ marginTop: 0 }}>Recent payments ({payments.length})</h2>
            {payments.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🧾</div>No payments recorded yet.
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </main>
  );
}
