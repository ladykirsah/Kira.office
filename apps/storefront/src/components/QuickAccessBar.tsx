import Link from "next/link";
import { Icon } from "@/components/Icon";
import { LINE_OA_URL } from "@/lib/links";

/**
 * Home quick-access shortcut toolbar (owner-approved "Design 2"): one white framed strip with inset
 * hairline dividers holding 4 thin-line shortcuts. The strip straddles an orange backdrop that
 * continues the header — see `.qa-section` in globals.css. Server component (plain links, no JS).
 * Icons come from the shared thin-line set (components/Icon.tsx), which owns each glyph's optical
 * scale; the "ช่วยหาอะไหล่" cell opens LINE OA when configured, otherwise falls back to /info.
 */
export function QuickAccessBar() {
  return (
    <nav className="qa-bar" aria-label="ทางลัด">
      <Link className="qa-item" href="/coupons">
        <span className="qa-ic">
          <Icon name="coupon" size={24} />
        </span>
        <span className="qa-lb">คูปองส่วนลด</span>
      </Link>
      <Link className="qa-item" href="/orders">
        <span className="qa-ic">
          <Icon name="truck" size={24} />
        </span>
        <span className="qa-lb">ติดตามคำสั่งซื้อ</span>
      </Link>
      <Link className="qa-item" href="/tools">
        <span className="qa-ic">
          <Icon name="wrench" size={24} />
        </span>
        <span className="qa-lb">เครื่องมือช่าง</span>
      </Link>
      <Link className="qa-item" href={LINE_OA_URL}>
        <span className="qa-ic">
          <Icon name="chat" size={24} />
        </span>
        <span className="qa-lb">ช่วยหาอะไหล่</span>
      </Link>
    </nav>
  );
}
