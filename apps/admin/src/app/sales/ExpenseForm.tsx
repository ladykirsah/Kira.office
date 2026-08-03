"use client";

import { useState } from "react";
import { EXPENSE_CHANNELS, type ExpenseChannel } from "@l-shopee/core";
import { type CreateExpenseInput } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import { useToast } from "../ToastProvider";

const CHANNEL_LABEL: Record<ExpenseChannel, string> = {
  onsite: "Den Air Service",
  airplus: "AirPlus",
};

/** A timestamp (ms) as local YYYY-MM-DD, the value an <input type="date"> expects. */
function msToISO(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const fieldLabel = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  color: "var(--text-muted)",
  marginBottom: 6,
  display: "block",
} as const;

export interface ExpenseFormValue {
  channel: ExpenseChannel;
  conversion: string;
  amountSatang: number;
  occurredAt: number;
  note: string | null;
}

/**
 * Record OR edit a Finance expense (money out) — Design B: channel first, then the fields. Collects
 * and validates the input, then hands it to onSubmit (the parent does the create/update + state).
 * Pass `initial` to prefill it as an inline editor for an existing expense.
 */
export function ExpenseForm({
  initial,
  title = "Add expense",
  submitLabel = "Add expense",
  onSubmit,
  onCancel,
}: {
  initial?: ExpenseFormValue;
  title?: string;
  submitLabel?: string;
  onSubmit: (input: CreateExpenseInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const [channel, setChannel] = useState<ExpenseChannel>(initial?.channel ?? "onsite");
  const [conversion, setConversion] = useState(initial?.conversion ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amountSatang / 100) : "");
  const [date, setDate] = useState(msToISO(initial?.occurredAt ?? Date.now()));
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);

  const amountSatang = Math.round(parseFloat(amount.replace(/,/g, "")) * 100);
  const amountValid = Number.isFinite(amountSatang) && amountSatang > 0;
  const valid = conversion.trim() !== "" && amountValid && date !== "";

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      await onSubmit({
        channel,
        conversion: conversion.trim(),
        amountSatang,
        note: note.trim() || null,
        occurredAt: new Date(`${date}T00:00:00`).getTime(),
      });
      toast(initial ? "Expense updated" : "Expense added", "success");
      if (!initial) {
        setConversion("");
        setAmount("");
        setNote("");
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const seg = (c: ExpenseChannel) => {
    const on = channel === c;
    return (
      <button
        key={c}
        type="button"
        onClick={() => setChannel(c)}
        style={{
          padding: "8px 14px",
          borderRadius: 9,
          border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
          background: on ? "var(--primary-soft)" : "var(--surface)",
          color: on ? "var(--primary)" : "var(--text)",
          fontWeight: 600,
          fontSize: 13.5,
          cursor: "pointer",
          minHeight: 0,
        }}
      >
        {CHANNEL_LABEL[c]}
      </button>
    );
  };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 18,
        background: "var(--surface)",
        marginTop: onCancel ? 0 : 14,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{title}</div>

      <span style={fieldLabel}>1 · Which channel?</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {EXPENSE_CHANNELS.map(seg)}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <div>
          <span style={fieldLabel}>Conversion</span>
          <input
            value={conversion}
            onChange={(e) => setConversion(e.target.value)}
            placeholder="e.g. AI package, refund DA-25080203"
            aria-label="Conversion"
            style={{ ...inputS, width: "100%" }}
          />
        </div>
        <div>
          <span style={fieldLabel}>Amount (฿)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount in baht"
            style={{ ...inputS, width: "100%" }}
          />
        </div>
        <div>
          <span style={fieldLabel}>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Expense date"
            style={{ ...inputS, width: "100%" }}
          />
        </div>
        <div>
          <span style={fieldLabel}>Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. monthly plan"
            aria-label="Note"
            style={{ ...inputS, width: "100%" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          {amountValid ? (
            <>
              Subtracts{" "}
              <span style={{ color: "var(--danger)", fontWeight: 600 }}>
                {formatBahtTrim(amountSatang)}
              </span>{" "}
              from {CHANNEL_LABEL[channel]} Profit.
            </>
          ) : (
            <>Lowers {CHANNEL_LABEL[channel]}&rsquo;s net Profit and lands in its table.</>
          )}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {onCancel && (
            <button type="button" className="btn-sm" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={!valid || busy}
            onClick={submit}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
