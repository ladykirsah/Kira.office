import { Icon, type IconName } from "@/components/Icon";
import type { Coupon } from "@/lib/coupons";

/**
 * Flat-card coupon (owner-picked design base). Presentational: `kind` sets colour + icon (money =
 * coral, ship = green); the caller passes the right-hand `action` — "เก็บ" on the catalog page,
 * "ใช้โค้ด" on the my-coupons page — so the same card serves both purposes.
 */
export function CouponCard({ c, action }: { c: Coupon; action?: React.ReactNode }) {
  const iconName: IconName = c.kind === "ship" ? "truck" : "coupon";
  return (
    <div className="coupon-card">
      <div className="coupon-top">
        <span className={`coupon-pill ${c.kind}`}>
          <Icon name={iconName} size={14} /> {c.value}
        </span>
        <span className="coupon-expiry">ใช้ได้ถึง {c.expiry}</span>
      </div>
      <div className="coupon-title">{c.title}</div>
      <div className="coupon-cond">{c.cond}</div>
      <div className="coupon-foot">
        <span className="coupon-code">{c.code}</span>
        {action}
      </div>
    </div>
  );
}
