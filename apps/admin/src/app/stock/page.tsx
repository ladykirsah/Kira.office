"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchStock,
  fetchStockMovements,
  adjustStock,
  type StockRow,
  type StockMovementRow,
} from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import { movementLabel, planAdjustment, type AdjustAction } from "@/lib/stock";
import { tableText } from "@/lib/tableText";
import { PageHeader } from "../PageHeader";
import { TableFrame } from "../TableFrame";
import { useToast } from "../ToastProvider";
import { useT } from "../LangProvider";
import type { Phrase } from "@/lib/lang";

const right = { textAlign: "right" } as const;

const STOCK_MOVEMENTS: Phrase = { th: "การเคลื่อนไหวสต๊อก", en: "Stock movements" };

const ACTIONS: { key: AdjustAction; label: Phrase; amountLabel: Phrase }[] = [
  {
    key: "receive",
    label: { th: "รับเข้า", en: "Receive" },
    amountLabel: { th: "จำนวนเข้า", en: "Qty in" },
  },
  {
    key: "write_off",
    label: { th: "ตัดออก", en: "Write-off" },
    amountLabel: { th: "จำนวนออก", en: "Qty out" },
  },
  {
    key: "correction",
    label: { th: "แก้ยอดเป็น", en: "Correct to" },
    amountLabel: { th: "นับได้", en: "Counted" },
  },
];

/** The column names, written once: the `th` reads them, every `td` carries the matching one as
 *  `data-label` for the phone's card layout — so the card always says exactly what the header
 *  says, in whichever language is on. */
const COLUMN: Record<string, Phrase> = {
  when: { th: "เมื่อไหร่", en: "When" },
  product: { th: "สินค้า", en: "Product" },
  movement: { th: "การเคลื่อนไหว", en: "Movement" },
  qty: { th: "จำนวน", en: "Qty" },
  onHand: { th: "คงเหลือ", en: "On hand" },
};

export default function StockMovementsPage() {
  const t = useT();
  const [stock, setStock] = useState<StockRow[] | null>(null);
  const [movements, setMovements] = useState<StockMovementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [adjVariant, setAdjVariant] = useState("");
  const [adjAction, setAdjAction] = useState<AdjustAction>("receive");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjBusy, setAdjBusy] = useState(false);

  const load = useCallback(() => {
    fetchStock()
      .then(setStock)
      .catch((err) => setError((err as Error).message));
    fetchStockMovements()
      .then(setMovements)
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function applyAdjustment() {
    const variant = (stock ?? []).find((r) => r.variantId === adjVariant);
    const amount = Math.round(parseFloat(adjAmount));
    if (!variant || !Number.isFinite(amount)) {
      toast(t({ th: "เลือกสินค้าและใส่จำนวน", en: "Pick a product and enter a number" }), "error");
      return;
    }
    // A correction sends the counted number; the server decides the delta (and whether it's a
    // no-op) against a fresh read, so the on-hand drawn at page load never decides anything.
    const plan = planAdjustment(adjAction, amount);
    setAdjBusy(true);
    try {
      const res = await adjustStock({
        productVariantId: variant.variantId,
        ...plan,
        reason: adjNote.trim() || undefined,
      });
      if (res.applied) {
        toast(`${variant.productName} → ${res.quantityAfter} on hand`, "success");
        setAdjAmount("");
        setAdjNote("");
        load();
      } else {
        toast(res.reason ?? t({ th: "ปรับยอดไม่สำเร็จ", en: "Adjustment rejected" }), "error");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdjBusy(false);
    }
  }

  if (error) {
    return (
      <main>
        <h1>{t(STOCK_MOVEMENTS)}</h1>
        <p style={{ color: "var(--danger)" }}>
          {t({ th: "โหลดสต๊อกไม่สำเร็จ:", en: "Could not load stock:" })} {error}
        </p>
      </main>
    );
  }

  const amountLabel = ACTIONS.find((a) => a.key === adjAction)?.amountLabel ?? {
    th: "จำนวน",
    en: "Amount",
  };

  return (
    <main>
      <PageHeader
        title={t(STOCK_MOVEMENTS)}
        subtitle={
          <>
            {t({
              th: "รับของเข้า ตัดของเสีย หรือแก้ยอดที่นับได้ — ทุกการเปลี่ยนแปลงถูกบันทึกไว้ด้านล่าง ยอดคงเหลือปัจจุบันของแต่ละสินค้าอยู่ที่",
              en: "Receive stock, write off damage, or correct a count — every change is logged below. Current on-hand per product lives on",
            })}{" "}
            <Link href="/products">{t({ th: "สินค้า", en: "Products" })}</Link>.
          </>
        }
      />

      {stock === null ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 20,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {t(COLUMN.product)}
            </span>
            <select
              value={adjVariant}
              onChange={(e) => setAdjVariant(e.target.value)}
              style={{ ...inputS, minWidth: 220 }}
            >
              <option value="">{t({ th: "เลือก…", en: "Select…" })}</option>
              {stock.map((r) => (
                <option key={r.variantId} value={r.variantId}>
                  {r.productName}
                  {r.sku ? ` · ${r.sku}` : ""} ({r.onHand})
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {t({ th: "การทำรายการ", en: "Action" })}
            </span>
            <select
              value={adjAction}
              onChange={(e) => setAdjAction(e.target.value as AdjustAction)}
              style={inputS}
            >
              {ACTIONS.map((a) => (
                <option key={a.key} value={a.key}>
                  {t(a.label)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {t(amountLabel)}
            </span>
            <input
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              inputMode="numeric"
              aria-label={t({ th: "จำนวนที่ปรับ", en: "Adjustment amount" })}
              style={{ ...inputS, width: 90 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, flex: "1 1 160px" }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {t({ th: "หมายเหตุ (ไม่บังคับ)", en: "Note (optional)" })}
            </span>
            <input
              value={adjNote}
              onChange={(e) => setAdjNote(e.target.value)}
              placeholder={t({ th: "เช่น ของจากซัพพลายเออร์", en: "e.g. supplier delivery" })}
              style={{ ...inputS, width: "100%" }}
            />
          </label>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={adjBusy}
            onClick={applyAdjustment}
          >
            {adjBusy ? t({ th: "กำลังปรับ…", en: "Applying…" }) : t({ th: "ปรับยอด", en: "Apply" })}
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          borderTop: "1px solid var(--border)",
          paddingTop: 18,
          marginBottom: 14,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>{t({ th: "ประวัติ", en: "History" })}</h2>
        <span className="muted" style={{ fontSize: 12 }}>
          {movements === null
            ? ""
            : t({ th: `${movements.length} รายการ`, en: `${movements.length} entries` })}
        </span>
      </div>

      {movements === null ? (
        <div className="skeleton skeleton-row" style={{ width: "50%" }} />
      ) : movements.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🧾</div>No stock movements yet.
        </div>
      ) : (
        <TableFrame cards>
          <table className="list-cards">
            <thead>
              <tr>
                <th>{t(COLUMN.when)}</th>
                <th>{t(COLUMN.product)}</th>
                <th>{t(COLUMN.movement)}</th>
                <th style={right}>{t(COLUMN.qty)}</th>
                <th style={right}>{t(COLUMN.onHand)}</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatUpdatedAt(m.createdAt)}</td>
                  <td data-label={t(COLUMN.product)}>
                    {m.productName}
                    {m.sku && (
                      <span
                        style={{
                          ...tableText.subtitle,
                          fontFamily: "var(--font-mono, monospace)",
                          marginLeft: 6,
                        }}
                      >
                        {m.sku}
                      </span>
                    )}
                  </td>
                  <td data-label={t(COLUMN.movement)}>{t(movementLabel(m.movementType))}</td>
                  <td
                    data-label={t(COLUMN.qty)}
                    style={{
                      ...right,
                      color: m.quantityDelta < 0 ? "var(--danger)" : "var(--ok)",
                      fontWeight: 600,
                    }}
                  >
                    {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                  </td>
                  <td data-label={t(COLUMN.onHand)} style={right}>
                    {m.quantityAfter}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}
    </main>
  );
}
