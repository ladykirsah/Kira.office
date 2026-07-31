"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  normalizeOrderStatus,
  normalizePaymentStatus,
  orderStatusLabel,
  paymentStatusLabel,
} from "@l-shopee/core";
import { SlipUpload } from "@/components/SlipUpload";
import { CodRejectedActions } from "@/components/CodRejectedActions";
import { RefundRequest } from "@/components/RefundRequest";
import { baht, formatDateTime, normalizePhone } from "@/lib/format";
import { imgUrl } from "@/lib/img";

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

interface LookupResult {
  ref: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  totalSatang: number;
  createdAt: number | null;
  shipTimeMs: number | null;
  carrier: string | null;
  trackingNo: string | null;
  customerName: string | null;
  /** Bounced-order refund state — a boolean (never the account itself) + the refunded timestamp. */
  hasRefundBank: boolean;
  refundedAt: number | null;
  /** Per-stage timestamps (from history) — each stage's date/time first subtitle line. */
  paidAt: number | null;
  bouncedAt: number | null;
  deliveredAt: number | null;
  cancelledAt: number | null;
  lines: LookupLine[];
}

type StepState = "done" | "current" | "pending";

interface Step {
  title: string;
  /** Date/time for this stage — the default FIRST subtitle line (null = no date to show). */
  at: number | null;
  /** The stage's detail — the line under the date. */
  detail: string | null;
  /** Carrier + tracking number, rendered "carrier · number" with a copy control on the number. */
  tracking: { carrier: string | null; trackingNo: string } | null;
  state: StepState;
}

function buildSteps(o: LookupResult): Step[] {
  // Normalize first: the column may hold Thai (pre-migration-0069) or English. Substring matching on
  // Thai was how a FAILED delivery (จัดส่งไม่สำเร็จ) matched `includes("สำเร็จ")` and told the customer
  // their order had arrived — the exact bug this removes.
  const pay = normalizePaymentStatus(o.paymentStatus);
  const ord = normalizeOrderStatus(o.orderStatus);

  const isCod = pay === "cod" || pay === "cod_confirmed" || pay === "cod_collected";
  const isAwaitingPayment = pay === "pending";
  const isVerifying = pay === "verifying";
  const refunded = pay === "refunded";

  const shipped = Boolean(o.carrier || o.trackingNo || o.shipTimeMs);
  const completed = ord === "delivered";
  const preparing = ord === "packing" || ord === "confirmed"; // paid, not yet with a carrier
  const bounced = ord === "delivery_failed";
  const cancelled = ord === "cancelled" || ord === "expired";

  const steps: Step[] = [
    { title: "สั่งซื้อแล้ว", at: o.createdAt, detail: null, tracking: null, state: "done" },
  ];

  // ── payment. A PASSED stage stays BLACK even after a later refund (the refund shows in the bounce
  //    stage); only a genuinely unpaid / verifying order is current, and nothing else is grey. ──
  if (isCod) {
    steps.push({
      title: "ชำระเงิน",
      at: null,
      detail: "เก็บเงินปลายทาง (จ่ายตอนรับของ)",
      tracking: null,
      state: "done",
    });
  } else if (isAwaitingPayment) {
    steps.push({
      title: "ชำระเงิน",
      at: null,
      detail: "ยังไม่ชำระเงิน",
      tracking: null,
      state: "current",
    });
  } else if (isVerifying) {
    // The slip is in and we are checking it — a paid customer must never read "ยังไม่ชำระเงิน".
    steps.push({
      title: "ชำระเงิน",
      at: null,
      detail: "กำลังตรวจสอบการชำระเงิน",
      tracking: null,
      state: "current",
    });
  } else if (pay === "paid" || refunded) {
    steps.push({
      title: "ชำระเงิน",
      at: o.paidAt,
      detail: "ชำระแล้ว",
      tracking: null,
      state: "done",
    });
  } else {
    // Only claim paid when the status says so — an unrecognised value is not "settled".
    steps.push({
      title: "ชำระเงิน",
      at: null,
      detail: pay ? paymentStatusLabel(pay) : null,
      tracking: null,
      state: "pending",
    });
  }

  // ── shipping. Date on line 1; "carrier · tracking" (tracking copiable) on line 2. ──
  if (shipped) {
    steps.push({
      title: "จัดส่ง",
      at: o.shipTimeMs,
      detail: o.trackingNo ? null : o.carrier,
      tracking: o.trackingNo ? { carrier: o.carrier, trackingNo: o.trackingNo } : null,
      state: "done",
    });
  } else if (cancelled) {
    steps.push({ title: "จัดส่ง", at: null, detail: null, tracking: null, state: "pending" });
  } else if (preparing) {
    steps.push({
      title: "จัดส่ง",
      at: null,
      detail: "กำลังเตรียมจัดส่ง",
      tracking: null,
      state: "current",
    });
  } else {
    steps.push({ title: "จัดส่ง", at: null, detail: "รอจัดส่ง", tracking: null, state: "pending" });
  }

  // ── outcome ──
  if (bounced) {
    // The bounce IS the stage; the refund progresses in its subtitle. Red while we still owe the
    // customer money, black once it has been paid back.
    const progress = refunded
      ? "คืนเงินแล้ว"
      : o.hasRefundBank
        ? "รอรับเงินใน 2–3 วันทำการ"
        : "รอลูกค้าส่งเลขบัญชี";
    steps.push({
      title: "ตีกลับ",
      at: o.bouncedAt,
      detail: progress,
      tracking: null,
      state: refunded ? "done" : "current",
    });
  } else if (cancelled) {
    steps.push({
      title: "ยกเลิกคำสั่งซื้อ",
      at: o.cancelledAt,
      detail: ord ? orderStatusLabel(ord) : null,
      tracking: null,
      state: "done",
    });
  } else if (completed) {
    steps.push({
      title: "สำเร็จ",
      at: o.deliveredAt,
      detail: "ได้รับสินค้าเรียบร้อย",
      tracking: null,
      state: "done",
    });
  } else {
    steps.push({ title: "สำเร็จ", at: null, detail: null, tracking: null, state: "pending" });
  }

  return steps;
}

/** A copy control for a tracking number — an icon that briefly ticks when the number is copied. */
function CopyIconButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label="คัดลอกเลขพัสดุ"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        } catch {
          /* clipboard may be blocked; the number is still on screen to copy by hand */
        }
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: ok ? "var(--ok)" : "var(--text-muted)",
      }}
    >
      {ok ? (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function TimelineStep({ step, last }: { step: Step; last: boolean }) {
  // The owner's rule (30 Jul 2026): gray = not happened yet, RED = the stage we are on now, BLACK =
  // already passed. One rule read straight down the timeline is what makes "where am I" answerable at
  // a glance. --text (not literal black) so it inverts correctly in dark mode.
  const dotColor =
    step.state === "done"
      ? "var(--text)"
      : step.state === "current"
        ? "var(--accent)"
        : "var(--border)";
  // Subtitles match the dot: the current stage is signalled in ONE colour, not gold under a red dot.
  const subColor = step.state === "current" ? "var(--accent)" : "var(--text-muted)";
  const sub = { fontSize: 13, marginTop: 2, color: subColor } as const;
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
            marginTop: 5,
          }}
        />
        {!last && (
          <span style={{ width: 2, flex: 1, minHeight: 20, background: "var(--border)" }} />
        )}
      </div>
      <div style={{ paddingBottom: last ? 2 : 22 }}>
        <div
          className="t-h4"
          style={{ color: step.state === "pending" ? "var(--text-muted)" : "var(--text)" }}
        >
          {step.title}
        </div>
        {/* Date/time is the default first subtitle line for every stage that has one. */}
        {step.at != null && <div style={sub}>{formatDateTime(step.at)}</div>}
        {step.detail && <div style={sub}>{step.detail}</div>}
        {step.tracking && (
          <div style={{ ...sub, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>
              {[step.tracking.carrier, step.tracking.trackingNo].filter(Boolean).join(" · ")}
            </span>
            <CopyIconButton text={step.tracking.trackingNo} />
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

  const steps = result ? buildSteps(result) : null;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="section">
        <h1 className="t-h1" style={{ margin: "0 0 4px", color: "var(--gray-dark)" }}>
          ติดตาม<span style={{ color: "var(--brand)" }}>คำสั่งซื้อ</span>
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
            {result.customerName && (
              <div className="muted" style={{ marginTop: 8 }}>
                ผู้สั่งซื้อ: {result.customerName}
              </div>
            )}
            {result.createdAt !== null && (
              <div className="muted" style={{ marginTop: 2 }}>
                สั่งซื้อเมื่อ {formatDateTime(result.createdAt)}
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
              <TimelineStep key={step.title} step={step} last={i === steps.length - 1} />
            ))}
            {/* Normalized, so this survives migration 0069 in either direction. Before, it matched
                the Thai literal exactly — an English 'pending' would have hidden the upload and left
                an unpaid customer with no way to send their slip at all. */}
            {normalizePaymentStatus(result.paymentStatus) === "pending" && (
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
            {normalizePaymentStatus(result.paymentStatus) === "cod_denied" && (
              <CodRejectedActions
                orderRef={result.ref}
                phone={phoneInput}
                onChanged={() => void lookup(result.ref, phoneInput)}
              />
            )}
            {/* A bounced parcel we were paid for: submit a bank account → wait → see the refund slip.
                The component picks its state (form / waiting / refunded evidence) from the props. */}
            {normalizeOrderStatus(result.orderStatus) === "delivery_failed" && (
              <RefundRequest
                orderRef={result.ref}
                phone={phoneInput}
                hasBank={result.hasRefundBank}
                refunded={normalizePaymentStatus(result.paymentStatus) === "refunded"}
                onChanged={() => void lookup(result.ref, phoneInput)}
              />
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
                <div
                  key={`${line.productRef}-${i}`}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>รวมทั้งหมด</span>
              <span className="t-price-m">{baht(result.totalSatang)}</span>
            </div>
          </div>
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
