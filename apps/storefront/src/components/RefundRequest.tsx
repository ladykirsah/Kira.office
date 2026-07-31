"use client";

import { useEffect, useState } from "react";

/**
 * Order-tracking UI for a bounced (delivery_failed) order we were paid for — the failed-delivery
 * refund, the one refund path handled in-app (every other return/claim goes through LINE OA).
 *
 *  - not refunded, no bank yet → the customer submits the bank account to refund to, with the policy.
 *  - not refunded, bank on file → a "we'll transfer within 2–3 business days" acknowledgement.
 *  - refunded → "คืนเงินแล้ว" with OUR transfer slip fetched back as evidence.
 */
export function RefundRequest({
  orderRef,
  phone,
  hasBank,
  refunded,
  onChanged,
}: {
  orderRef: string;
  phone: string;
  hasBank: boolean;
  refunded: boolean;
  onChanged: () => void;
}) {
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);

  // Our outgoing refund slip, fetched by POST so the phone never lands in a URL, then shown as a blob.
  useEffect(() => {
    if (!refunded) return;
    let revoked = false;
    let url: string | null = null;
    void (async () => {
      try {
        const res = await fetch("/api/orders/refund-slip", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ref: orderRef, phone }),
        });
        if (!res.ok) return;
        url = URL.createObjectURL(await res.blob());
        if (!revoked) setSlipUrl(url);
      } catch {
        /* evidence image is best-effort; the "คืนเงินแล้ว" text still stands on its own */
      }
    })();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [refunded, orderRef, phone]);

  const wrap = { marginTop: 12, paddingTop: 14, borderTop: "1px solid var(--border)" } as const;

  if (refunded) {
    return (
      <div style={wrap}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px", color: "var(--brand-deep)" }}>
          คืนเงินแล้ว
        </p>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
          เราได้โอนเงินคืนเต็มจำนวนให้เรียบร้อยแล้ว — สลิปการโอนเป็นหลักฐานด้านล่าง
        </p>
        {slipUrl && (
          <img
            src={slipUrl}
            alt="สลิปการคืนเงิน"
            style={{
              maxWidth: 260,
              width: "100%",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          />
        )}
      </div>
    );
  }

  if (hasBank) {
    return (
      <div style={wrap}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>ได้รับข้อมูลบัญชีแล้ว</p>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          เราจะโอนเงินคืนเต็มจำนวนภายใน 2–3 วันทำการ
        </p>
      </div>
    );
  }

  const canSubmit = !!bankName.trim() && !!accountNo.trim() && !!accountName.trim();

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/refund-bank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: orderRef, phone, bankName, accountNo, accountName }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        setBusy(false);
        return;
      }
      onChanged();
    } catch {
      setError("ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง");
      setBusy(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "9px 11px",
    fontSize: 14,
    border: "1px solid var(--border)",
    borderRadius: 8,
    boxSizing: "border-box" as const,
  };

  return (
    <div style={wrap}>
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>
        พัสดุตีกลับ — แจ้งบัญชีเพื่อรับเงินคืน
      </p>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
        กรอกบัญชีธนาคารของคุณ เราจะโอนคืนเต็มจำนวนภายใน 2–3 วันทำการ
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        <input
          style={inputStyle}
          placeholder="ธนาคาร (เช่น กสิกรไทย)"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
        />
        <input
          style={inputStyle}
          inputMode="numeric"
          placeholder="เลขที่บัญชี"
          value={accountNo}
          onChange={(e) => setAccountNo(e.target.value)}
        />
        <input
          style={inputStyle}
          placeholder="ชื่อบัญชี"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 10 }}
        disabled={busy || !canSubmit}
        onClick={() => void submit()}
      >
        {busy ? "กำลังส่ง…" : "ส่งข้อมูลบัญชี"}
      </button>
      {error && (
        <div role="alert" style={{ marginTop: 8, color: "var(--danger)", fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}
