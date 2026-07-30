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
  lines: LookupLine[];
}

type StepState = "done" | "current" | "pending";

interface Step {
  title: string;
  detail: string | null;
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

  const shipDetail = shipped
    ? [
        [o.carrier, o.trackingNo].filter(Boolean).join(" · ") || null,
        o.shipTimeMs ? formatDateTime(o.shipTimeMs) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return [
    {
      title: "สั่งซื้อแล้ว",
      detail: o.createdAt ? formatDateTime(o.createdAt) : null,
      state: "done",
    },
    isCod
      ? { title: "ชำระเงิน", detail: "เก็บเงินปลายทาง (จ่ายตอนรับของ)", state: "done" }
      : isAwaitingPayment
        ? { title: "ชำระเงิน", detail: "ยังไม่ชำระเงิน", state: "current" }
        : isVerifying
          ? // The slip is in and we are checking it. Previously this state did not exist, so a
            // customer who had paid saw "ยังไม่ชำระเงิน" and was chased for money they had sent.
            { title: "ชำระเงิน", detail: "กำลังตรวจสอบการชำระเงิน", state: "current" }
          : {
              title: "ชำระเงิน",
              // Only claim paid when the status actually says so. The old fallback treated ANY
              // unrecognised value as paid and showed it in green, so an English constant after
              // migration 0069 would have told an unpaid customer they were settled.
              detail: pay ? paymentStatusLabel(pay) : null,
              // Only `paid` reaches here as settled — every COD variant was caught by isCod above.
              state: pay === "paid" ? "done" : "pending",
            },
    shipped
      ? { title: "จัดส่ง", detail: shipDetail, state: "done" }
      : cancelled
        ? { title: "จัดส่ง", detail: null, state: "pending" }
        : preparing
          ? { title: "จัดส่ง", detail: "กำลังเตรียมจัดส่ง", state: "current" }
          : { title: "จัดส่ง", detail: "รอจัดส่ง", state: "pending" },
    cancelled || bounced
      ? {
          title: refunded ? "คืนเงินแล้ว" : bounced ? "ตีกลับ" : "ยกเลิกคำสั่งซื้อ",
          // Show the Thai label for the state, never the raw column — that used to leak the stored
          // value straight to the customer, which after 0069 would have been an English token.
          detail: ord ? orderStatusLabel(ord) : null,
          state: "done",
        }
      : completed
        ? { title: "สำเร็จ", detail: "ได้รับสินค้าเรียบร้อย", state: "done" }
        : { title: "สำเร็จ", detail: null, state: "pending" },
  ];
}

function TimelineStep({ step, last }: { step: Step; last: boolean }) {
  // The owner's rule (30 Jul 2026): gray = not happened yet, RED = the stage we are on now,
  // BLACK = already passed. Nothing overrides it — a single rule read straight down the timeline is
  // what makes "where am I" answerable at a glance, and a fourth colour anywhere breaks that.
  // --text rather than a literal black so it inverts correctly in dark mode.
  const dotColor =
    step.state === "done"
      ? "var(--text)"
      : step.state === "current"
        ? "var(--accent)"
        : "var(--border)";
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
          style={{
            color: step.state === "pending" ? "var(--text-muted)" : "var(--text)",
          }}
        >
          {step.title}
        </div>
        {step.detail && (
          <div
            style={{
              fontSize: 13,
              marginTop: 2,
              // Matches the dot: the current stage is signalled in ONE colour, not gold text under
              // a red dot. Revert this line alone if the detail should stay neutral.
              color: step.state === "current" ? "var(--accent)" : "var(--text-muted)",
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
