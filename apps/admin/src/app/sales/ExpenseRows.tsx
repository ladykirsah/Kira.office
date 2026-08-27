"use client";

import { useState } from "react";
import { updateExpense, type ExpenseRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import { tableText } from "@/lib/tableText";
import { useToast } from "../ToastProvider";
import { ExpenseActionsMenu } from "./ExpenseActionsMenu";
import { useT } from "../LangProvider";
import { COLUMN } from "./columns";

const dateTH = (ms: number) => new Date(ms).toLocaleDateString("th-TH");

/** A timestamp (ms) as local YYYY-MM-DD, the value an <input type="date"> expects. */
function msToISO(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * The expense rows shared by the Den Air and AirPlus tables: money-out rows (plain Conversion text
 * as the identity, no Sales, a negative Profit, an "Expense" status) with an Actions ▾ menu.
 * Edit turns the row's own cells (Conversion / Amount / Date) into inputs; Save PUTs the change
 * (channel + note are preserved). Delete soft-deletes.
 *
 * The cells line up with the six columns of BOTH tables — identity · Sales · Profit · Date ·
 * Status · Actions — and each carries its column's word as a `data-label`, because on a phone the
 * header row is hidden and every row is read as a card. Without them an expense was a column of
 * bare numbers sitting under nothing, while the sale rows above it read fine.
 */
export function ExpenseRows({
  expenses,
  onEdited,
  onDeleted,
}: {
  expenses: ExpenseRow[];
  onEdited: (e: ExpenseRow) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [conversion, setConversion] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  function startEdit(e: ExpenseRow) {
    setEditingId(e.id);
    setConversion(e.conversion);
    setAmount(String(e.amountSatang / 100));
    setDate(msToISO(e.occurredAt));
  }

  const amountSatang = Math.round(parseFloat(amount.replace(/,/g, "")) * 100);
  const valid =
    conversion.trim() !== "" && Number.isFinite(amountSatang) && amountSatang > 0 && date !== "";

  async function save(e: ExpenseRow) {
    if (!valid) return;
    setBusy(true);
    try {
      const updated = await updateExpense(e.id, {
        channel: e.channel,
        conversion: conversion.trim(),
        amountSatang,
        note: e.note, // preserved — not shown/edited inline
        occurredAt: new Date(`${date}T00:00:00`).getTime(),
      });
      toast(t({ th: "แก้ไขค่าใช้จ่ายแล้ว", en: "Expense updated" }), "success");
      setEditingId(null);
      onEdited(updated);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {expenses.map((e) => {
        const editing = editingId === e.id;
        return (
          <tr key={e.id}>
            {/* Conversion — the row's identity; an input while editing */}
            <td style={{ whiteSpace: "nowrap" }}>
              {editing ? (
                <input
                  value={conversion}
                  onChange={(ev) => setConversion(ev.target.value)}
                  aria-label={t({ th: "รายการ", en: "Conversion" })}
                  style={{ ...inputS, width: "100%" }}
                />
              ) : (
                <div style={tableText.body2}>{e.conversion}</div>
              )}
            </td>
            {/* Sales — expenses have none, so the column is there and the figure is not */}
            <td data-label={t(COLUMN.sales)}>
              <span className="muted">—</span>
            </td>
            {/* Amount (shown as a negative Profit); a baht input while editing */}
            <td
              data-label={t(COLUMN.profit)}
              style={editing ? undefined : { color: "var(--danger)" }}
            >
              {editing ? (
                <input
                  value={amount}
                  onChange={(ev) => setAmount(ev.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={t({ th: "จำนวนเงินเป็นบาท", en: "Amount in baht" })}
                  style={{ ...inputS, width: "100%" }}
                />
              ) : (
                formatBahtTrim(-e.amountSatang)
              )}
            </td>
            {/* Date — a date picker while editing */}
            <td data-label={t(COLUMN.date)} style={{ whiteSpace: "nowrap" }}>
              {editing ? (
                <input
                  type="date"
                  value={date}
                  onChange={(ev) => setDate(ev.target.value)}
                  aria-label={t({ th: "วันที่ของค่าใช้จ่าย", en: "Expense date" })}
                  style={{ ...inputS, width: "100%" }}
                />
              ) : (
                <div style={tableText.body2}>{dateTH(e.occurredAt)}</div>
              )}
            </td>
            <td data-label={t(COLUMN.status)}>
              <span className="pill bad">{t({ th: "ค่าใช้จ่าย", en: "Expense" })}</span>
            </td>
            {/* Actions — Save / Cancel while editing, else the Actions ▾ menu */}
            <td>
              {editing ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={!valid || busy}
                    onClick={() => save(e)}
                  >
                    {t({ th: "บันทึก", en: "Save" })}
                  </button>
                  <button
                    type="button"
                    className="btn-sm"
                    disabled={busy}
                    onClick={() => setEditingId(null)}
                  >
                    {t({ th: "ยกเลิก", en: "Cancel" })}
                  </button>
                </div>
              ) : (
                <ExpenseActionsMenu
                  expenseId={e.id}
                  onEdit={() => startEdit(e)}
                  onDeleted={onDeleted}
                />
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
