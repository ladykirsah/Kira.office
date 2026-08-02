"use client";

import { useState } from "react";
import { EXPENSE_CHANNELS, type ExpenseChannel } from "@l-shopee/core";
import { createExpense, type ExpenseRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import { useToast } from "../ToastProvider";

const CHANNEL_LABEL: Record<ExpenseChannel, string> = {
  onsite: "Den Air Service",
  airplus: "AirPlus",
};

/** Today as YYYY-MM-DD for the date input's default. */
function todayISO(): string {
  const d = new Date();
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

/**
 * Record a Finance expense (money out) — Design B: channel first, then the fields. On submit it
 * persists via the API and calls onCreated so the page folds it into the channel table + Profit.
 */
export function ExpenseForm({ onCreated }: { onCreated: (e: ExpenseRow) => void }) {
  const toast = useToast();
  const [channel, setChannel] = useState<ExpenseChannel>("onsite");
  const [conversion, setConversion] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const amountSatang = Math.round(parseFloat(amount.replace(/,/g, "")) * 100);
  const amountValid = Number.isFinite(amountSatang) && amountSatang > 0;
  const valid = conversion.trim() !== "" && amountValid && date !== "";

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      const created = await createExpense({
        channel,
        conversion: conversion.trim(),
        amountSatang,
        note: note.trim() || null,
        occurredAt: new Date(`${date}T00:00:00`).getTime(),
      });
      toast("Expense added", "success");
      setConversion("");
      setAmount("");
      setNote("");
      onCreated(created);
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
        marginTop: 14,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Add expense</div>

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
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={!valid || busy}
          onClick={submit}
        >
          Add expense
        </button>
      </div>
    </div>
  );
}
