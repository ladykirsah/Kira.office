import Link from "next/link";

const ICON = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// Each icon's raw path fills the 24×24 box differently, so every icon is wrapped in a <g> that
// contain-fits its own bounding box into a centred 20px box → they all read as the SAME optical
// size. `vector-effect: non-scaling-stroke` (globals.css) keeps the 1.8px line identical despite
// the per-icon scale.
const couponIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" {...ICON}>
    <g transform="translate(12 12) scale(1.25) translate(-12 -12)">
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v1.6a1.9 1.9 0 0 0 0 3.8v1.6A1.5 1.5 0 0 1 18.5 17h-13A1.5 1.5 0 0 1 4 15.5v-1.6a1.9 1.9 0 0 0 0-3.8Z" />
      <path d="m9.6 10.4 4.8 3.2" />
      <path d="M9.8 10.2h.01" />
      <path d="M14.2 13.8h.01" />
    </g>
  </svg>
);
const truckIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" {...ICON}>
    <g transform="translate(12 12) scale(0.909) translate(-12 -12.65)">
      <rect x="1" y="5" width="14" height="11" rx="1.5" />
      <path d="M15 8h4l4 4v4h-8" />
      <circle cx="6" cy="18.5" r="1.8" />
      <circle cx="18" cy="18.5" r="1.8" />
    </g>
  </svg>
);
const wrenchIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" {...ICON}>
    <g transform="translate(12 12) scale(1.053) translate(-12.5 -11.5)">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </g>
  </svg>
);
// chat bubble + magnifier → "talk to a real person to find a part" (distinct from the search magnifier)
const helpIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" {...ICON}>
    <g transform="translate(12 12) scale(1.111) translate(-12 -12)">
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.5 8.5 0 1 1 17 0Z" />
      <circle cx="11" cy="11" r="2.3" />
      <path d="m12.8 12.8 1.7 1.7" />
    </g>
  </svg>
);

/**
 * Home quick-access shortcut toolbar (owner-approved "Design 2"): one white framed strip with inset
 * hairline dividers holding 4 thin-line shortcuts. The strip straddles an orange backdrop that
 * continues the header — see `.qa-section` in globals.css. Server component (plain links, no JS).
 * The "ช่วยหาอะไหล่" cell opens LINE OA when configured; otherwise falls back to the on-site /info page.
 */
export function QuickAccessBar() {
  const lineUrl = process.env.NEXT_PUBLIC_LINE_OA_URL;
  const helpHref = lineUrl || "/info";
  const helpExternal = Boolean(lineUrl);
  return (
    <nav className="qa-bar" aria-label="ทางลัด">
      <Link className="qa-item" href="/coupons">
        <span className="qa-ic">{couponIcon}</span>
        <span className="qa-lb">คูปองส่วนลด</span>
      </Link>
      <Link className="qa-item" href="/orders">
        <span className="qa-ic">{truckIcon}</span>
        <span className="qa-lb">ติดตามคำสั่งซื้อ</span>
      </Link>
      <Link className="qa-item" href="/tools">
        <span className="qa-ic">{wrenchIcon}</span>
        <span className="qa-lb">เครื่องมือช่าง</span>
      </Link>
      <a
        className="qa-item"
        href={helpHref}
        {...(helpExternal ? { target: "_blank", rel: "noopener" } : {})}
      >
        <span className="qa-ic">{helpIcon}</span>
        <span className="qa-lb">ช่วยหาอะไหล่</span>
      </a>
    </nav>
  );
}
