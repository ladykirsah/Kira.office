"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CouponCard } from "@/components/CouponCard";
import { ALL_COUPONS, readCollectedCodes, writeCollectedCodes } from "@/lib/coupons";

/** Full catalog with a "เก็บ" (collect) action per coupon. Collecting adds the code to the shopper's
 *  wallet (localStorage) so it appears on /account/coupons; an already-collected code shows ✓ เก็บแล้ว. */
export function AvailableCoupons() {
  const [collected, setCollected] = useState<string[]>([]);
  useEffect(() => setCollected(readCollectedCodes()), []);

  function collect(code: string) {
    setCollected((prev) => {
      if (prev.includes(code)) return prev;
      const next = [...prev, code];
      writeCollectedCodes(next);
      return next;
    });
  }

  return (
    <>
      <div className="coupon-list">
        {ALL_COUPONS.map((c) => (
          <CouponCard
            key={c.code}
            c={c}
            action={
              collected.includes(c.code) ? (
                <span className="coupon-collected">✓ เก็บแล้ว</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary coupon-use"
                  onClick={() => collect(c.code)}
                >
                  เก็บ
                </button>
              )
            }
          />
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <Link href="/account/coupons" className="btn btn-text btn-primary">
          ดูคูปองของฉัน →
        </Link>
      </div>
    </>
  );
}
