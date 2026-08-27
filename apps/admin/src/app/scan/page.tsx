"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  lookupBarcode,
  holdStock,
  adjustStock,
  getProductDetail,
  saveDraft,
  type HoldLineResult,
} from "@/lib/api";
import { inputS } from "@/lib/inputStyles";
import { formatBaht } from "@/lib/format";
import { PageHeader } from "../PageHeader";
import { BackLink } from "../BackLink";
import type { Phrase } from "@/lib/lang";
import { useToast } from "../ToastProvider";
import { useT } from "../LangProvider";
import { ScanInput } from "./ScanInput";
import { BarcodePreview } from "../products/BarcodePreview";

type Mode = "add" | "view" | "hold" | "fill" | "pos";

/** Module-level, so it carries PHRASES and each render translates them — a `useT()` cannot be
 *  called out here. `title` doubles as the page subtitle once a mode is picked. */
const MODES: {
  key: Mode;
  icon: string;
  title: Phrase;
  desc: Phrase;
  ready: boolean;
}[] = [
  {
    key: "add",
    icon: "🆕",
    title: { th: "เพิ่มสินค้าใหม่", en: "Add new product" },
    desc: { th: "สแกนอะไหล่เพื่อเริ่มสร้างรายการใหม่", en: "Scan a part to start a new listing." },
    ready: true,
  },
  {
    key: "view",
    icon: "🔍",
    title: { th: "ดูสินค้า", en: "View product" },
    desc: { th: "สแกนเพื่อเปิดหน้าสินค้า", en: "Scan to open a product." },
    ready: true,
  },
  {
    key: "hold",
    icon: "⏸️",
    title: { th: "พักของ", en: "On hold" },
    desc: { th: "ย้ายของเข้าหรือออกจากที่พัก", en: "Move stock to or from the hold." },
    ready: true,
  },
  {
    key: "fill",
    icon: "📥",
    title: { th: "เติมสต๊อก", en: "Fill stock" },
    desc: { th: "รับของเข้าสต๊อกคงเหลือ", en: "Receive stock into on hand." },
    ready: true,
  },
  {
    key: "pos",
    icon: "🧾",
    title: { th: "ขายหน้าร้าน", en: "POS" },
    desc: { th: "สแกนสินค้าเพื่อสร้างบิล", en: "Scan items to build a bill." },
    ready: true,
  },
];

const card = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "16px 18px",
  background: "var(--surface)",
} as const;

/**
 * "Scan here" — one shortcut page for every barcode task. Opens on a menu of five modes; the mode
 * picked drives what happens with each scan. Add and View hand off to an existing page; On hold,
 * Fill stock and POS finish on this page (built in later steps).
 */
export default function ScanPage() {
  const t = useT();
  const [mode, setMode] = useState<Mode | null>(null);
  const picked = MODES.find((m) => m.key === mode);

  return (
    <main>
      <PageHeader
        title={t({ th: "สแกนที่นี่", en: "Scan here" })}
        subtitle={
          mode === null
            ? t({ th: "เลือกว่าจะสแกนเพื่ออะไร", en: "Pick what you're scanning for." })
            : picked
              ? t(picked.title)
              : ""
        }
        below={
          mode === null ? undefined : (
            <BackLink onClick={() => setMode(null)}>
              {t({ th: "โหมดสแกนทั้งหมด", en: "All scan modes" })}
            </BackLink>
          )
        }
      />
      {mode === null ? (
        <ModeMenu onPick={setMode} />
      ) : mode === "add" ? (
        <AddMode />
      ) : mode === "view" ? (
        <ViewMode />
      ) : mode === "hold" ? (
        <HoldMode />
      ) : mode === "fill" ? (
        <FillMode />
      ) : mode === "pos" ? (
        <PosMode />
      ) : (
        <ComingSoon title={picked ? t(picked.title) : ""} />
      )}
    </main>
  );
}

function ModeMenu({ onPick }: { onPick: (m: Mode) => void }) {
  const t = useT();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
        gap: 14,
      }}
    >
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onPick(m.key)}
          disabled={!m.ready}
          title={m.ready ? t(m.title) : t({ th: "เร็วๆ นี้", en: "Coming soon" })}
          style={{
            ...card,
            textAlign: "left",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            cursor: m.ready ? "pointer" : "not-allowed",
            opacity: m.ready ? 1 : 0.55,
          }}
        >
          <span style={{ fontSize: 26, lineHeight: 1 }}>{m.icon}</span>
          <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              {t(m.title)}
              {!m.ready && <span className="pill off">{t({ th: "เร็วๆ นี้", en: "Soon" })}</span>}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>
              {t(m.desc)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Add new product: scan one code, then hand off to the new-product form with it pre-filled. */
function AddMode() {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 460 }}>
      <ScanInput
        onScan={setCode}
        buttonLabel={t({ th: "สแกน", en: "Scan" })}
        placeholder={t({ th: "สแกนบาร์โค้ดอะไหล่ชิ้นใหม่…", en: "Scan a new part's barcode…" })}
      />
      {code && (
        <div style={{ ...card, display: "grid", gap: 12 }}>
          {/* The scanned code is both the Product ID and the barcode source — one identifier. */}
          <div style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {t({ th: "รหัสสินค้า / บาร์โค้ด", en: "Product ID / barcode" })}
            </span>
            <strong style={{ fontSize: 18 }}>{code}</strong>
          </div>
          <BarcodePreview value={code} />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => router.push(`/products/new?ref=${encodeURIComponent(code)}`)}
            >
              {t({ th: "เพิ่ม", en: "Add" })}
            </button>
            <button type="button" onClick={() => setCode(null)}>
              {t({ th: "สแกนชิ้นต่อไป", en: "Scan another" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** View product: scan one code, look it up, and open its detail page. */
function ViewMode() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function open(rawCode: string) {
    setBusy(true);
    try {
      const found = await lookupBarcode(rawCode);
      if (!found) {
        toast(
          t({ th: `ไม่พบสินค้าสำหรับ ${rawCode}`, en: `No product found for ${rawCode}` }),
          "error",
        );
        return;
      }
      router.push(`/products/${found.productId}`);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 460 }}>
      <ScanInput
        onScan={open}
        buttonLabel={t({ th: "เปิด", en: "Open" })}
        disabled={busy}
        placeholder={t({ th: "สแกนบาร์โค้ดสินค้า…", en: "Scan a product's barcode…" })}
      />
      <p className="muted" style={{ fontSize: 13 }}>
        {t({ th: "สแกนแล้วจะเปิดหน้าสินค้าให้ดู", en: "Scanning opens the product in view mode." })}
      </p>
    </div>
  );
}

interface HoldRow {
  variantId: string;
  name: string;
  productRef: string;
  takeAway: string;
  bringBack: string;
  result?: HoldLineResult;
}

const numCell = { ...inputS, width: 78 } as const;

/** The column label and the field's screen-reader name are the same words — one string each. */
const TAKE_AWAY: Phrase = { th: "เอาออก", en: "Take away" };
const BRING_BACK: Phrase = { th: "นำกลับ", en: "Bring back" };
const RECEIVED: Phrase = { th: "รับเข้า", en: "Received" };
/** Every mode's list uses the same two buttons, so they are written once. */
const REMOVE: Phrase = { th: "เอาออก", en: "Remove" };
const CLEAR: Phrase = { th: "ล้าง", en: "Clear" };
const SUBMIT: Phrase = { th: "ยืนยัน", en: "Submit" };
const QTY: Phrase = { th: "จำนวน", en: "Qty" };

/**
 * On hold — a stock BUCKET, not a reservation. Scan several parts, then per row say how many to take
 * away (on hand ↓, on hold ↑) or bring back (on hand ↑, on hold ↓), and submit once. Held stock stops
 * counting as sellable everywhere — AirPlus, POS, the products table — because a hold is recorded as
 * a negative ledger movement.
 *
 * Take-away defaults to 1 (the usual reason you scan here) and bring-back to 0: defaulting BOTH to 1
 * would cancel out and silently do nothing.
 */
function HoldMode() {
  const t = useT();
  const toast = useToast();
  const [rows, setRows] = useState<HoldRow[]>([]);
  const [busy, setBusy] = useState(false);

  async function add(code: string) {
    try {
      const found = await lookupBarcode(code);
      if (!found) {
        toast(t({ th: `ไม่พบสินค้าสำหรับ ${code}`, en: `No product found for ${code}` }), "error");
        return;
      }
      setRows((prev) =>
        // Re-scanning a part already in the list must not wipe amounts already typed for it.
        prev.some((r) => r.variantId === found.variantId)
          ? prev
          : [
              ...prev,
              {
                variantId: found.variantId,
                name: found.name,
                productRef: found.productRef,
                takeAway: "1",
                bringBack: "0",
              },
            ],
      );
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  const setQty = (variantId: string, field: "takeAway" | "bringBack", value: string) =>
    setRows((prev) =>
      prev.map((r) =>
        r.variantId === variantId ? { ...r, [field]: value, result: undefined } : r,
      ),
    );

  const toCount = (s: string) => Math.max(0, Math.round(parseFloat(s) || 0));

  async function submit() {
    const lines = rows.map((r) => ({
      productVariantId: r.variantId,
      takeAway: toCount(r.takeAway),
      bringBack: toCount(r.bringBack),
    }));
    if (lines.every((l) => l.takeAway === 0 && l.bringBack === 0)) {
      toast(
        t({
          th: "ยังไม่มีอะไรให้ย้าย — ใส่จำนวนก่อน",
          en: "Nothing to move — set an amount first",
        }),
        "error",
      );
      return;
    }
    setBusy(true);
    try {
      const results = await holdStock(lines);
      setRows((prev) =>
        prev.map((r) => ({ ...r, result: results.find((x) => x.variantId === r.variantId) })),
      );
      const moved = results.filter((r) => r.applied).length;
      const rejected = results.filter((r) => !r.applied && r.reason !== "no change").length;
      toast(
        rejected ? `${moved} moved, ${rejected} rejected` : `${moved} moved`,
        rejected ? "error" : "success",
      );
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ maxWidth: 460 }}>
        <ScanInput
          onScan={add}
          buttonLabel={t({ th: "เพิ่ม", en: "Add" })}
          placeholder={t({ th: "สแกนอะไหล่ที่จะย้าย…", en: "Scan parts to move…" })}
          disabled={busy}
        />
      </div>

      {rows.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          {t({
            th: "สแกนอะไหล่หนึ่งชิ้นหรือมากกว่า ของที่พักไว้จะถูกหยุดไว้ — ไม่ถูกขายบน AirPlus หรือหน้าร้านจนกว่าจะนำกลับมา",
            en: "Scan one or more parts. Stock on hold is paused — it is not sold on AirPlus or at the counter until it is brought back.",
          })}
        </p>
      ) : (
        <>
          <div style={{ ...card, display: "grid", gap: 4 }}>
            {rows.map((r, i) => (
              <div
                key={r.variantId}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                  paddingTop: 10,
                  borderTop: i === 0 ? undefined : "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <div
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={r.name}
                  >
                    {r.name}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.productRef}
                  </div>
                </div>
                <label style={{ display: "grid", gap: 3 }}>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {t(TAKE_AWAY)}
                  </span>
                  <input
                    value={r.takeAway}
                    onChange={(e) => setQty(r.variantId, "takeAway", e.target.value)}
                    inputMode="numeric"
                    aria-label={`${t(TAKE_AWAY)} ${r.name}`}
                    style={numCell}
                  />
                </label>
                <label style={{ display: "grid", gap: 3 }}>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {t(BRING_BACK)}
                  </span>
                  <input
                    value={r.bringBack}
                    onChange={(e) => setQty(r.variantId, "bringBack", e.target.value)}
                    inputMode="numeric"
                    aria-label={`${t(BRING_BACK)} ${r.name}`}
                    style={numCell}
                  />
                </label>
                <div style={{ fontSize: 12, flex: "1 1 150px" }}>
                  {r.result ? (
                    r.result.applied ? (
                      <span style={{ color: "var(--ok)" }}>
                        on hand {r.result.sellableAfter} · on hold {r.result.heldAfter}
                      </span>
                    ) : (
                      <span style={{ color: "var(--danger)" }}>{r.result.reason}</span>
                    )
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setRows((p) => p.filter((x) => x.variantId !== r.variantId))}
                  disabled={busy}
                >
                  {t(REMOVE)}
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
              {t(SUBMIT)}
            </button>
            <button type="button" onClick={() => setRows([])} disabled={busy}>
              {t(CLEAR)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface FillRow {
  variantId: string;
  name: string;
  productRef: string;
  qty: string;
  result?: { applied: boolean; quantityAfter: number; reason?: string };
}

/**
 * Fill stock — receive scanned parts into sellable on-hand. Scan several, set how many of each
 * arrived (default 1), and Submit writes a 'receive' ledger movement per line (the inverse of a
 * write-off). No hold interaction — moving stock to/from the hold is the On hold mode's job.
 */
function FillMode() {
  const t = useT();
  const toast = useToast();
  const [rows, setRows] = useState<FillRow[]>([]);
  const [busy, setBusy] = useState(false);

  async function add(code: string) {
    try {
      const found = await lookupBarcode(code);
      if (!found) {
        toast(t({ th: `ไม่พบสินค้าสำหรับ ${code}`, en: `No product found for ${code}` }), "error");
        return;
      }
      setRows((prev) =>
        prev.some((r) => r.variantId === found.variantId)
          ? prev
          : [
              ...prev,
              {
                variantId: found.variantId,
                name: found.name,
                productRef: found.productRef,
                qty: "1",
              },
            ],
      );
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  const setQty = (variantId: string, value: string) =>
    setRows((prev) =>
      prev.map((r) => (r.variantId === variantId ? { ...r, qty: value, result: undefined } : r)),
    );

  const toCount = (s: string) => Math.max(0, Math.round(parseFloat(s) || 0));

  async function submit() {
    const lines = rows.map((r) => ({ row: r, qty: toCount(r.qty) }));
    if (lines.every((l) => l.qty === 0)) {
      toast(t({ th: "ใส่จำนวนที่รับเข้ามาก่อน", en: "Enter how many arrived first" }), "error");
      return;
    }
    setBusy(true);
    let received = 0;
    let failed = 0;
    // Sequential so the per-line result maps cleanly; the ledger DO serializes the writes anyway.
    for (const { row, qty } of lines) {
      if (qty === 0) continue;
      try {
        const res = await adjustStock({
          productVariantId: row.variantId,
          quantityDelta: qty,
          movementType: "receive",
          reason: "received via Scan here",
        });
        setRows((prev) =>
          prev.map((r) => (r.variantId === row.variantId ? { ...r, result: res } : r)),
        );
        if (res.applied) received++;
        else failed++;
      } catch (err) {
        const reason = (err as Error).message;
        setRows((prev) =>
          prev.map((r) =>
            r.variantId === row.variantId
              ? { ...r, result: { applied: false, quantityAfter: 0, reason } }
              : r,
          ),
        );
        failed++;
      }
    }
    setBusy(false);
    toast(
      failed ? `${received} received, ${failed} failed` : `${received} received`,
      failed ? "error" : "success",
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ maxWidth: 460 }}>
        <ScanInput
          onScan={add}
          buttonLabel={t({ th: "เพิ่ม", en: "Add" })}
          placeholder={t({ th: "สแกนอะไหล่ที่รับเข้ามา…", en: "Scan parts you received…" })}
          disabled={busy}
        />
      </div>

      {rows.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          {t({
            th: "สแกนอะไหล่ที่เข้ามา ใส่จำนวนของแต่ละชิ้น แล้วกดยืนยันเพื่อเพิ่มเข้าสต๊อกคงเหลือ",
            en: "Scan the parts that arrived, set how many of each, then Submit to add them to on-hand stock.",
          })}
        </p>
      ) : (
        <>
          <div style={{ ...card, display: "grid", gap: 4 }}>
            {rows.map((r, i) => (
              <div
                key={r.variantId}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                  paddingTop: 10,
                  borderTop: i === 0 ? undefined : "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <div
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={r.name}
                  >
                    {r.name}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.productRef}
                  </div>
                </div>
                <label style={{ display: "grid", gap: 3 }}>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {t(RECEIVED)}
                  </span>
                  <input
                    value={r.qty}
                    onChange={(e) => setQty(r.variantId, e.target.value)}
                    inputMode="numeric"
                    aria-label={`${t(RECEIVED)} ${r.name}`}
                    style={numCell}
                  />
                </label>
                <div style={{ fontSize: 12, flex: "1 1 130px" }}>
                  {r.result ? (
                    r.result.applied ? (
                      <span style={{ color: "var(--ok)" }}>on hand {r.result.quantityAfter}</span>
                    ) : (
                      <span style={{ color: "var(--danger)" }}>{r.result.reason}</span>
                    )
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setRows((p) => p.filter((x) => x.variantId !== r.variantId))}
                  disabled={busy}
                >
                  {t(REMOVE)}
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
              {t(SUBMIT)}
            </button>
            <button type="button" onClick={() => setRows([])} disabled={busy}>
              {t(CLEAR)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface PosRow {
  variantId: string;
  name: string;
  productRef: string;
  unitPriceSatang: number;
  unitCostSatang: number;
  qty: string;
}

/**
 * POS — scan several parts into a matched, priced list, then Create bill hands off to /pos with the
 * cart already filled (via a parked draft opened at /pos?draft=<id>). Prices are the on-site B2C
 * price; the owner reviews and finalizes in /pos (which re-prices server-side at checkout), so this
 * page never takes money itself.
 */
function PosMode() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<PosRow[]>([]);
  const [busy, setBusy] = useState(false);

  const toCount = (s: string) => Math.max(0, Math.round(parseFloat(s) || 0));

  async function add(code: string) {
    setBusy(true);
    try {
      const found = await lookupBarcode(code);
      if (!found) {
        toast(t({ th: `ไม่พบสินค้าสำหรับ ${code}`, en: `No product found for ${code}` }), "error");
        return;
      }
      // Price comes from the product's own pricing, so it isn't capped by the products-list limit.
      const detail = await getProductDetail(found.productId).catch(() => null);
      setRows((prev) => {
        // Re-scanning an item already in the cart bumps its quantity — the usual till behaviour.
        if (prev.some((r) => r.variantId === found.variantId)) {
          return prev.map((r) =>
            r.variantId === found.variantId ? { ...r, qty: String(toCount(r.qty) + 1) } : r,
          );
        }
        return [
          ...prev,
          {
            variantId: found.variantId,
            name: found.name,
            productRef: found.productRef,
            unitPriceSatang: detail?.pricing?.targetPriceSatang ?? 0,
            unitCostSatang: detail?.pricing?.itemCostSatang ?? 0,
            qty: "1",
          },
        ];
      });
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const setQty = (variantId: string, value: string) =>
    setRows((prev) => prev.map((r) => (r.variantId === variantId ? { ...r, qty: value } : r)));

  const totalSatang = rows.reduce((sum, r) => sum + r.unitPriceSatang * toCount(r.qty), 0);

  async function createBill() {
    const lines = rows
      .map((r) => ({
        productVariantId: r.variantId,
        lineType: "part" as const,
        description: r.name,
        barcodeValue: r.productRef,
        quantity: toCount(r.qty),
        unitPriceSatang: r.unitPriceSatang,
        unitCostSatang: r.unitCostSatang,
      }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      toast(t({ th: "สแกนอย่างน้อยหนึ่งชิ้นก่อน", en: "Scan at least one item first" }), "error");
      return;
    }
    setBusy(true);
    try {
      const draftId = crypto.randomUUID();
      await saveDraft({ draftId, stage: "draft", saleType: "parts", lines });
      router.push(`/pos?draft=${draftId}`);
    } catch (err) {
      toast((err as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ maxWidth: 460 }}>
        <ScanInput
          onScan={add}
          buttonLabel={t({ th: "เพิ่ม", en: "Add" })}
          placeholder={t({ th: "สแกนสินค้าเข้าบิล…", en: "Scan items to bill…" })}
          disabled={busy}
        />
      </div>

      {rows.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          {t({
            th: "สแกนอะไหล่ที่จะขาย กดสร้างบิลแล้วจะเปิดหน้าขายพร้อมของอยู่ในตะกร้าแล้ว รอแค่ปิดการขาย",
            en: "Scan the parts to sell. Create bill opens the till with them already in the cart, ready to finalize.",
          })}
        </p>
      ) : (
        <>
          <div style={{ ...card, display: "grid", gap: 4 }}>
            {rows.map((r, i) => (
              <div
                key={r.variantId}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                  paddingTop: 10,
                  borderTop: i === 0 ? undefined : "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                  <div
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={r.name}
                  >
                    {r.name}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.productRef} · {formatBaht(r.unitPriceSatang)}
                  </div>
                </div>
                <label style={{ display: "grid", gap: 3 }}>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {t(QTY)}
                  </span>
                  <input
                    value={r.qty}
                    onChange={(e) => setQty(r.variantId, e.target.value)}
                    inputMode="numeric"
                    aria-label={`${t(QTY)} ${r.name}`}
                    style={numCell}
                  />
                </label>
                <div style={{ width: 90, textAlign: "right", fontWeight: 600 }}>
                  {formatBaht(r.unitPriceSatang * toCount(r.qty))}
                </div>
                <button
                  type="button"
                  onClick={() => setRows((p) => p.filter((x) => x.variantId !== r.variantId))}
                  disabled={busy}
                >
                  {t(REMOVE)}
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700 }}>
              {t({ th: "รวม", en: "Total" })} {formatBaht(totalSatang)}
            </span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-primary" onClick={createBill} disabled={busy}>
              {t({ th: "สร้างบิล", en: "Create bill" })}
            </button>
            <button type="button" onClick={() => setRows([])} disabled={busy}>
              {t(CLEAR)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  const t = useT();
  return (
    <div style={{ ...card, maxWidth: 460 }}>
      <p style={{ margin: 0 }}>
        {/* The mode's name is a value, so the sentence is written around it in each language
            rather than glued together from pieces — Thai does not put it where English does. */}
        {t({ th: `กำลังสร้าง${title}อยู่`, en: `${title} is being built.` })}
      </p>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
        {t({
          th: "โหมดนี้จะทำงานจบในหน้านี้ — สแกนหลายชิ้นแล้วกดยืนยัน",
          en: "This mode will finish on this page — scanning multiple items, then a submit.",
        })}
      </p>
    </div>
  );
}
