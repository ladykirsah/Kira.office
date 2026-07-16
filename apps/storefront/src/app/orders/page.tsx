"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildOrderTimeline, type TimelineStep } from "@l-shopee/core";
import { SlipUpload } from "@/components/SlipUpload";
import { baht, formatDateTime, normalizePhone } from "@/lib/format";
import { imgUrl } from "@/lib/img";
import { LINE_OA_URL } from "@/lib/links";

/**
 * Order tracking by phone + order number — no account, no Facebook login, no "save this link"
 * bill URLs (the competitor pattern AirPlus exists to fix). The (ref, phone) pair is the whole
 * credential; the API returns an identical 404 for wrong-ref and wrong-phone.
 */

interface LookupLine {
  name: string;
  productRef: string;
  imageKey: string | null;
  quantity: number;
  unitPriceSatang: number;
  lineTotalSatang: number;
}

interface ShippingAddress {
  recipientName: string | null;
  phone: string | null;
  line1: string;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
}

interface ReturnRequest {
  kind: string;
  reason: string;
  status: string;
  decisionNote: string | null;
  createdAt: number;
  /** when the mechanic decided — drives the คืนเงินสำเร็จ / คืนเงินไม่สำเร็จ step's time */
  decidedAt: number | null;
}

interface LookupResult {
  ref: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  /** money, fully itemised so the customer can check the arithmetic themselves */
  subtotalSatang: number;
  discountSatang: number;
  shippingSatang: number;
  totalSatang: number;
  createdAt: number | null;
  /** when the transfer was confirmed; null unless a slip auto-verified (see the timeline's `at`) */
  paidAt: number | null;
  completedAt: number | null;
  shipTimeMs: number | null;
  carrier: string | null;
  trackingNo: string | null;
  customerName: string | null;
  paymentMethod: string | null;
  /** COD proof — no payments row is ever written for cash-on-delivery */
  hasPaymentRecord: boolean;
  shippingAddress: ShippingAddress | null;
  /** what the customer may DO — decided server-side by @l-shopee/core, never re-derived here, so a
   *  button can never appear that the API would refuse */
  canCancel: boolean;
  /** COD orders never need a transfer slip, so they never get the upload block (owner, 2026-07-16) */
  canUploadSlip: boolean;
  returnEligibility: { allowed: boolean; reason: string };
  returnRequest: ReturnRequest | null;
  lines: LookupLine[];
}

const RETURN_REASONS = [
  "สินค้าไม่ตรงรุ่นรถ",
  "สินค้าชำรุด/เสียหาย",
  "ได้รับสินค้าผิดรุ่น",
  "สินค้าใช้งานไม่ได้",
  "เปลี่ยนใจ",
  "อื่น ๆ",
];

const CANCEL_REASONS = [
  "สั่งผิดรุ่น/ผิดรายการ",
  "เจอราคาถูกกว่า",
  "ไม่ต้องการแล้ว",
  "สั่งซ้ำ",
  "อื่น ๆ",
];

/** One address on one line, skipping the parts an order may legitimately not have. */
function formatAddress(a: ShippingAddress): string {
  return [a.line1, a.subdistrict, a.district, a.province, a.postalCode].filter(Boolean).join(" ");
}

/**
 * One step of the timeline. All state decisions were made by buildOrderTimeline in @l-shopee/core
 * (tested there); this only paints them.
 *
 * The connector below a step is coloured by the step's OWN tone, so the coral runs down exactly as
 * far as the journey has got and turns grey from the current step onward — a progress bar you read
 * without words.
 */
function TimelineRow({ step, last }: { step: TimelineStep; last: boolean }) {
  const lineTone = step.tone === "done" ? "done" : "future";
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span className={`tl-dot ${step.tone}`} />
        {!last && <span className={`tl-line ${lineTone}`} />}
      </div>
      <div style={{ paddingBottom: last ? 2 : 22, minWidth: 0 }}>
        <div
          className="t-h4"
          style={{
            color:
              step.tone === "future"
                ? "var(--text-muted)"
                : step.tone === "bad"
                  ? "var(--danger)"
                  : "var(--text)",
            // The second, non-colour cue that marks where you are — hue alone is too weak at 12px.
            fontWeight: step.tone === "current" ? 800 : undefined,
          }}
        >
          {step.title}
        </div>
        {step.at !== null && (
          <div style={{ fontSize: 13, marginTop: 2, color: "var(--text-muted)" }}>
            {formatDateTime(step.at)}
          </div>
        )}
        {step.detail && (
          <div
            style={{
              fontSize: 13,
              marginTop: 2,
              color: step.tone === "bad" ? "var(--danger)" : "var(--text-muted)",
            }}
          >
            {step.detail}
          </div>
        )}
      </div>
    </div>
  );
}

function LineThumb({ imageKey, name }: { imageKey: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!imageKey || failed) {
    return (
      <div className="frame" style={{ width: 56, height: 56, flexShrink: 0 }}>
        <span aria-hidden="true" style={{ fontSize: 44, lineHeight: 1, color: "var(--brand)" }}>
          ✦
        </span>
      </div>
    );
  }
  return (
    <div className="frame" style={{ width: 56, height: 56, flexShrink: 0 }}>
      <img src={imgUrl(imageKey)} alt={name} onError={() => setFailed(true)} />
    </div>
  );
}

function MoneyRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span className="muted" style={{ fontSize: 14 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

/**
 * ยกเลิกคำสั่งซื้อ / คืนสินค้า — the customer's two exits, previously missing entirely (the only
 * route out was finding the shop's LINE and hoping).
 *
 * Every eligibility decision here comes from the SERVER (result.canCancel / result.returnEligibility),
 * computed by @l-shopee/core — the same functions the endpoints enforce with. This component never
 * re-derives them from status strings, so it cannot offer a button the API would then refuse.
 *
 * The two actions are deliberately asymmetric, because their consequences are:
 *  • Cancel acts immediately (order → ยกเลิก, stock back on the shelf) and is irreversible for the
 *    customer, so it asks for a typed confirmation step rather than firing on one tap.
 *  • คืน/เคลม only FILES a request — the shop's mechanic decides — so it submits directly, then
 *    hands off to LINE where that mechanic actually works.
 */
function OrderActions({
  result,
  phone,
  onChanged,
}: {
  result: LookupResult;
  phone: string;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<null | "cancel" | "return">(null);
  const [kind, setKind] = useState<"return" | "claim">("return");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const req = result.returnRequest;
  const canReturn = result.returnEligibility.allowed;
  const expired = result.returnEligibility.reason === "window-expired";
  // The mechanic has already said no. Offering "คืนสินค้า / เคลม" again would invite the customer to
  // re-file the very claim that was just refused — a loop that wastes both sides' time. A human is
  // the only thing that can move this forward now, so the single action becomes LINE.
  const rejected = result.returnEligibility.reason === "rejected";

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: result.ref, phone, ...body }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return false;
      }
      return true;
    } catch {
      setErr("ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Nothing actionable and nothing filed → render nothing rather than an empty card.
  if (!result.canCancel && !canReturn && !req && !expired && !rejected) return null;

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
        ความช่วยเหลือ
      </div>
      <h2 className="t-h2" style={{ margin: "0 0 12px", color: "var(--gray-dark)" }}>
        จัดการคำสั่งซื้อ
      </h2>

      {/* An existing request outranks every button: the customer's question is now "what did they
          say?", and a rejection must never be silent — the shop's own words are shown verbatim. */}
      {req && (
        <div
          style={{
            padding: 12,
            borderRadius: "var(--radius-sm)",
            background: req.status === "ปฏิเสธ" ? "var(--danger-soft)" : "var(--ok-soft)",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {req.kind === "claim" ? "คำขอเคลม" : "คำขอคืนสินค้า"} · {req.status}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {req.reason} · ส่งเมื่อ {formatDateTime(req.createdAt)}
          </div>
          {req.decisionNote && (
            <div style={{ fontSize: 13, marginTop: 6 }}>คำตอบจากร้าน: {req.decisionNote}</div>
          )}
          {req.status === "รอตรวจสอบ" && (
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              ทีมช่างกำลังตรวจสอบ และจะติดต่อกลับทาง LINE
            </div>
          )}
        </div>
      )}

      {done && (
        <div
          role="status"
          style={{
            padding: 12,
            borderRadius: "var(--radius-sm)",
            background: "var(--ok-soft)",
            color: "var(--ok)",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          {done}
        </div>
      )}

      {err && (
        <div
          role="alert"
          style={{
            padding: 12,
            borderRadius: "var(--radius-sm)",
            background: "var(--danger-soft)",
            color: "var(--danger)",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      {mode === null && (
        <div style={{ display: "grid", gap: 8 }}>
          {result.canCancel && (
            // Plain .btn, exactly like คืนสินค้า / เคลม below. Recolouring this one red was drift:
            // --danger is var(--brand-deep), so a "warning" red sits a shade away from the brand
            // coral all over this page — it reads as a style choice, not a warning. The safety here
            // is the confirmation step, which spells out that cancelling cannot be undone; that is
            // a job for words, not for a colour nobody can reliably decode.
            <button
              type="button"
              className="btn btn-block"
              onClick={() => {
                setMode("cancel");
                setReason("");
                setErr(null);
              }}
            >
              ยกเลิกคำสั่งซื้อ
            </button>
          )}
          {canReturn && (
            <button
              type="button"
              className="btn btn-block"
              onClick={() => {
                setMode("return");
                setReason("");
                setErr(null);
              }}
            >
              คืนสินค้า / เคลม
            </button>
          )}
          {rejected && (
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener"
              className="btn btn-block btn-primary"
            >
              ติดต่อร้านค้า
            </a>
          )}
          {expired && !req && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              เลยกำหนดคืนสินค้า 7 วันแล้ว — หากสินค้ามีปัญหา ยัง{" "}
              <a
                href={LINE_OA_URL}
                target="_blank"
                rel="noopener"
                style={{ color: "var(--brand)" }}
              >
                ทักร้านทาง LINE
              </a>{" "}
              ได้เสมอ
            </p>
          )}
        </div>
      )}

      {mode === "cancel" && (
        <div style={{ display: "grid", gap: 10 }}>
          <p style={{ fontSize: 14, margin: 0 }}>
            ยืนยันยกเลิกคำสั่งซื้อ <strong>{result.ref}</strong>? การยกเลิกทำแล้วย้อนกลับไม่ได้
            {result.paymentStatus === "ชำระแล้ว" && " — ร้านจะติดต่อคืนเงินให้ภายหลัง"}
          </p>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="cancel-reason">เหตุผล (ไม่บังคับ)</label>
            <select
              id="cancel-reason"
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">— เลือกเหตุผล —</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              onClick={() => setMode(null)}
              disabled={busy}
            >
              ไม่ยกเลิก
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={busy}
              onClick={async () => {
                if (await post("/api/orders/cancel", { reason })) {
                  setMode(null);
                  setDone("ยกเลิกคำสั่งซื้อแล้ว");
                  onChanged();
                }
              }}
            >
              {busy ? "กำลังยกเลิก…" : "ยืนยันยกเลิก"}
            </button>
          </div>
        </div>
      )}

      {mode === "return" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="return-kind">ประเภท</label>
            <select
              id="return-kind"
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value === "claim" ? "claim" : "return")}
            >
              <option value="return">คืนสินค้า (ขอคืนเงิน)</option>
              <option value="claim">เคลมประกัน (ขอเปลี่ยนตัวใหม่)</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="return-reason">เหตุผล</label>
            <select
              id="return-reason"
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">— เลือกเหตุผล —</option>
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="return-note">รายละเอียดเพิ่มเติม (ไม่บังคับ)</label>
            <textarea
              id="return-note"
              className="input"
              rows={3}
              value={note}
              placeholder="เช่น ใส่กับ Vigo ปี 2012 แล้วขนาดไม่ตรง"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            ทีมช่างจะตรวจสอบคำขอก่อนอนุมัติ แล้วติดต่อกลับทาง LINE
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              onClick={() => setMode(null)}
              disabled={busy}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={busy || !reason}
              onClick={async () => {
                if (await post("/api/orders/returns", { kind, reason, note })) {
                  setMode(null);
                  setDone("ส่งคำขอแล้ว — ทีมช่างจะติดต่อกลับทาง LINE");
                  onChanged();
                }
              }}
            >
              {busy ? "กำลังส่ง…" : "ส่งคำขอ"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const initialRef = (searchParams.get("ref") ?? "").trim().toUpperCase();
  const initialPhone = searchParams.get("phone") ?? "";

  const [refInput, setRefInput] = useState(initialRef);
  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [copied, setCopied] = useState(false);
  // Keep the submit disabled until both fields are adequately filled — an order ref plus a full
  // 9–10 digit phone — so an incomplete form can't fire a guaranteed-to-fail lookup.
  const canSubmit = refInput.trim().length > 0 && normalizePhone(phoneInput).length >= 9;
  // Reached via a deep link (the account "ดูสถานะ" button, or a shared ?ref=&phone= URL)? Then the
  // shopper already knows the order — drop the lookup form so the page is purely about that order,
  // with an escape link to track a different one.
  const cameViaLink = Boolean(initialRef && initialPhone);
  const showForm = !(cameViaLink && (loading || result));

  const lookup = useCallback(async (refRaw: string, phoneRaw: string) => {
    const ref = refRaw.trim().toUpperCase();
    const phone = normalizePhone(phoneRaw);
    if (!ref || !phone) {
      setError("กรุณากรอกเลขที่คำสั่งซื้อและเบอร์โทรศัพท์");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/orders/lookup?ref=${encodeURIComponent(ref)}&phone=${encodeURIComponent(phone)}`,
      );
      const body = (await res.json()) as LookupResult & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setResult(body);
    } catch {
      setError("ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, []);

  // Deep link: /orders?ref=AP-XXXX&phone=08XXXXXXXX auto-runs the lookup on arrival.
  useEffect(() => {
    if (initialRef && initialPhone) void lookup(initialRef, initialPhone);
  }, [initialRef, initialPhone, lookup]);

  async function copyRef(ref: string) {
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (e.g. non-secure context) — silently skip
    }
  }

  const steps = result
    ? buildOrderTimeline({
        orderStatus: result.orderStatus,
        paymentStatus: result.paymentStatus,
        hasPaymentRecord: result.hasPaymentRecord,
        createdAt: result.createdAt,
        paidAt: result.paidAt,
        shipTimeMs: result.shipTimeMs,
        completedAt: result.completedAt,
        carrier: result.carrier,
        trackingNo: result.trackingNo,
        returnRequest: result.returnRequest,
      })
    : null;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="section">
        {/* Two pages, one route: the form is where you TRACK something down, a loaded order is its
            DETAILS. cameViaLink (not `result`) drives it so a deep link never flashes the wrong
            headline while the lookup is still in flight. */}
        <h1 className="t-h1" style={{ margin: "0 0 4px", color: "var(--gray-dark)" }}>
          {cameViaLink || result ? (
            <>
              รายละเอียด<span style={{ color: "var(--brand)" }}>คำสั่งซื้อ</span>
            </>
          ) : (
            <>
              ติดตาม<span style={{ color: "var(--brand)" }}>คำสั่งซื้อ</span>
            </>
          )}
        </h1>
        {showForm && (
          <p className="muted" style={{ margin: 0 }}>
            ใช้เบอร์โทรและเลขที่คำสั่งซื้อ — ไม่ต้องสมัครสมาชิก ไม่ต้องเก็บลิงก์
          </p>
        )}
      </div>

      {showForm && (
        <form
          className="card"
          style={{ padding: 20 }}
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(refInput, phoneInput);
          }}
        >
          <div className="field">
            <label htmlFor="order-ref">เลขที่คำสั่งซื้อ</label>
            <input
              id="order-ref"
              className="input"
              placeholder="AP-XXXXXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              style={{ textTransform: "uppercase" }}
              value={refInput}
              onChange={(e) => setRefInput(e.target.value.toUpperCase())}
            />
          </div>
          <div className="field">
            <label htmlFor="order-phone">เบอร์โทรศัพท์</label>
            <input
              id="order-phone"
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="08XXXXXXXX"
              autoComplete="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || !canSubmit}
          >
            {loading ? "กำลังค้นหา…" : "ติดตามคำสั่งซื้อ"}
          </button>
        </form>
      )}

      {cameViaLink && loading && !result && (
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <span className="muted">กำลังโหลดคำสั่งซื้อ…</span>
        </div>
      )}

      {error && (
        <div
          className="card"
          role="alert"
          style={{
            marginTop: 16,
            padding: 16,
            background: "var(--danger-soft)",
            borderColor: "var(--danger-soft)",
            color: "var(--danger)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {result && steps && (
        // minmax(0,1fr): without it the implicit auto track grows to the widest child's
        // min-content (the nowrap product-name line) and every card overflows the viewport.
        <div
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, marginTop: 16 }}
        >
          {/* ---- order header ---- */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="t-h3">{result.ref}</span>
              <button
                type="button"
                onClick={() => void copyRef(result.ref)}
                className="btn btn-s btn-text btn-default"
                style={{ color: copied ? "var(--ok)" : "var(--text-muted)" }}
              >
                {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
            </div>
            {/* The order date lives in the timeline's "สั่งซื้อแล้ว" step, and the buyer already
                knows their own name — this space now answers the two things they actually re-open
                the page to check: where is it going, and how am I paying? */}
            {result.shippingAddress && (
              <div style={{ marginTop: 10 }}>
                <div className="muted" style={{ fontSize: 13 }}>
                  จัดส่งไปที่
                </div>
                <div style={{ fontSize: 14, marginTop: 2 }}>
                  {[result.shippingAddress.recipientName, result.shippingAddress.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 1 }}>
                  {formatAddress(result.shippingAddress)}
                </div>
              </div>
            )}
            {result.paymentMethod && (
              <div style={{ marginTop: 10 }}>
                <div className="muted" style={{ fontSize: 13 }}>
                  ชำระโดย
                </div>
                <div style={{ fontSize: 14, marginTop: 2 }}>{result.paymentMethod}</div>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
              }}
            >
              <span className="muted">ยอดรวม</span>
              <span className="t-price-m">{baht(result.totalSatang)}</span>
            </div>
          </div>

          {/* ---- status timeline ---- */}
          <div className="card" style={{ padding: 20 }}>
            <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
              ความคืบหน้า
            </div>
            <h2 className="t-h2" style={{ margin: "0 0 16px", color: "var(--gray-dark)" }}>
              สถานะคำสั่งซื้อ
            </h2>
            {steps.map((step, i) => (
              <TimelineRow key={step.key} step={step} last={i === steps.length - 1} />
            ))}
            {/* Server-decided (canUploadSlip in @l-shopee/core), not re-derived from the status
                string here: COD must never be asked to prove a transfer it never made, and this
                block used to be excluded only as a SIDE EFFECT of COD's status happening not to be
                'รอชำระเงิน'. Now it is excluded on purpose, by the same rule the API enforces. */}
            {result.canUploadSlip && (
              <div style={{ marginTop: 12, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
                  โอนแล้ว? แนบสลิปเพื่อยืนยันการชำระเงิน
                </p>
                <SlipUpload
                  orderRef={result.ref}
                  phone={phoneInput}
                  onConfirmed={() => void lookup(result.ref, phoneInput)}
                />
              </div>
            )}
          </div>

          {/* ---- order lines ---- */}
          <div className="card" style={{ padding: 20 }}>
            <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
              รายละเอียด
            </div>
            <h2 className="t-h2" style={{ margin: "0 0 14px", color: "var(--gray-dark)" }}>
              รายการสินค้า
            </h2>
            <div style={{ display: "grid", gap: 14 }}>
              {result.lines.map((line, i) => (
                // minWidth:0 is load-bearing: this row is a GRID item, and a grid item's automatic
                // minimum size is its min-content width. The product name below is white-space:nowrap,
                // so its min-content is the whole untruncated string — without this the track inflates
                // to ~560px inside a 343px card and the entire PAGE scrolls sideways (the sticky header
                // then only covers the viewport, leaving a white gutter). The minWidth:0 on the name
                // wrapper alone cannot save it; the shrink has to be allowed here first.
                <div
                  key={`${line.productRef}-${i}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}
                >
                  <LineThumb imageKey={line.imageKey} name={line.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="t-body"
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {line.name}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {line.productRef} · ×{line.quantity}
                    </div>
                  </div>
                  <div className="t-price-m" style={{ whiteSpace: "nowrap" }}>
                    {baht(line.lineTotalSatang)}
                  </div>
                </div>
              ))}
            </div>
            {/* Full arithmetic, so the customer can prove the total to themselves. Every row is
                always shown once the order has one — a discount that silently vanishes reads as a
                mistake, and "ฟรี" is a selling point worth stating out loud rather than a 0 to hide. */}
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                display: "grid",
                gap: 6,
              }}
            >
              <MoneyRow label="ยอดรวมสินค้า" value={baht(result.subtotalSatang)} />
              {result.discountSatang > 0 && (
                <MoneyRow
                  label="ส่วนลด"
                  value={`-${baht(result.discountSatang)}`}
                  color="var(--ok)"
                />
              )}
              <MoneyRow
                label="ค่าจัดส่ง"
                value={result.shippingSatang > 0 ? baht(result.shippingSatang) : "ฟรี"}
                color={result.shippingSatang > 0 ? undefined : "var(--ok)"}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 10,
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>รวมทั้งหมด</span>
              <span className="t-price-m">{baht(result.totalSatang)}</span>
            </div>
          </div>

          <OrderActions
            result={result}
            phone={phoneInput || initialPhone}
            onChanged={() => void lookup(result.ref, phoneInput || initialPhone)}
          />
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<p className="muted">กำลังโหลด…</p>}>
      <OrdersContent />
    </Suspense>
  );
}
