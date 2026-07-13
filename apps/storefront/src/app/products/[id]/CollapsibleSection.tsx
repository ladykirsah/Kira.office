"use client";

import { useState } from "react";

/**
 * A PDP "Design A" section block whose body can be shown/hidden. Renders as a white `.pdp-block`
 * with a bold bilingual header (Thai + gray English) and a chevron that rotates 90° when open.
 * Open by default; the shopper can collapse it. Used for รุ่นรถที่ใช้ได้ (Fitment) and คำอธิบาย
 * (Description) — the "รายละเอียดสินค้า" spec block above stays always-visible (server-rendered).
 */
export function CollapsibleSection({
  titleTh,
  titleEn,
  defaultOpen = true,
  children,
}: {
  titleTh: string;
  titleEn: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pdp-block">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "transparent",
          border: "none",
          padding: 0,
          margin: 0,
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--gray-dark)" }}>
          {titleTh}
          <span
            style={{ color: "var(--gray-mid)", fontWeight: 500, fontSize: 12.5, marginLeft: 7 }}
          >
            {titleEn}
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            color: open ? "var(--brand)" : "var(--gray-mid)",
            fontSize: 18,
            lineHeight: 1,
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        >
          ›
        </span>
      </button>
      {open && <div style={{ paddingTop: 11 }}>{children}</div>}
    </div>
  );
}
