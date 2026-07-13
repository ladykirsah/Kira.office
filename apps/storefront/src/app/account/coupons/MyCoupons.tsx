"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CouponCard } from "@/components/CouponCard";
import { UseCodeButton } from "@/components/UseCodeButton";
import { ALL_COUPONS, readCollectedCodes, writeCollectedCodes } from "@/lib/coupons";

/** The shopper's collected coupons (from the localStorage wallet), each with "ใช้โค้ด" (copy) and a
 *  quiet remove. Empty until they collect some on /coupons — hence the nudge back there. */
export function MyCoupons() {
  const [codes, setCodes] = useState<string[] | null>(null); // null = not yet read (avoids SSR flash)
  useEffect(() => setCodes(readCollectedCodes()), []);

  function remove(code: string) {
    setCodes((prev) => {
      const next = (prev ?? []).filter((c) => c !== code);
      writeCollectedCodes(next);
      return next;
    });
  }

  if (codes === null) return null;

  const mine = ALL_COUPONS.filter((c) => codes.includes(c.code));

  if (mine.length === 0) {
    return (
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600 }}>ยังไม่มีคูปองที่เก็บไว้</p>
        <p className="muted" style={{ margin: "0 0 16px" }}>
          เก็บคูปองส่วนลดไว้ที่นี่ แล้วหยิบมาใช้ตอนชำระเงินได้เลย
        </p>
        <Link href="/coupons" className="btn btn-primary">
          ไปเก็บคูปอง →
        </Link>
      </div>
    );
  }

  return (
    <div className="coupon-list">
      {mine.map((c) => (
        <CouponCard
          key={c.code}
          c={c}
          action={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                className="btn btn-text btn-default btn-s"
                onClick={() => remove(c.code)}
              >
                ลบ
              </button>
              <UseCodeButton code={c.code} />
            </span>
          }
        />
      ))}
    </div>
  );
}
