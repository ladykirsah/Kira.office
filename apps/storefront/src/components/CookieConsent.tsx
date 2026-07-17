"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  acceptAll,
  rejectAll,
  makeConsent,
  selectionOf,
  readStoredConsent,
  storeConsent,
  needsConsent,
  OPEN_SETTINGS_EVENT,
  type CategorySelection,
  type CookieCategory,
  type CookieConsent as Consent,
} from "@/lib/cookieConsent";

/**
 * PDPA cookie-consent (docs/policies/cookie-policy.md §3). Mounted once in the root layout.
 * - Default = Design B (friendly sheet): ยอมรับทั้งหมด / ปฏิเสธทั้งหมด (equal-weight buttons) + ตั้งค่า.
 * - "ตั้งค่า" (or the footer link, via OPEN_SETTINGS_EVENT) = Design C: per-category toggles.
 * Opt-in: non-essential categories stay off until chosen. The choice + timestamp is stored (PDPA
 * evidence). SSR-safe: renders nothing until mounted, so localStorage is never read during hydration.
 */

const CATS: { key: CookieCategory; name: string; desc: string }[] = [
  { key: "analytics", name: "วิเคราะห์การใช้งาน", desc: "วัดผู้เข้าชม · ปรับปรุงเว็บ" },
  { key: "marketing", name: "การตลาด/โฆษณา", desc: "รีทาร์เก็ต · วัดผลโฆษณา" },
  { key: "thirdParty", name: "บริการบุคคลที่สาม", desc: "LINE OA · ระบบชำระเงิน" },
];

type Mode = "hidden" | "banner" | "settings";

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("hidden");
  const [sel, setSel] = useState<CategorySelection>({
    analytics: false,
    marketing: false,
    thirdParty: false,
  });

  useEffect(() => {
    setMounted(true);
    if (needsConsent(readStoredConsent())) setMode("banner");
    // Footer "ตั้งค่าคุกกี้" → re-open Design C seeded with the current choice.
    const openSettings = () => {
      setSel(selectionOf(readStoredConsent()));
      setMode("settings");
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
  }, []);

  if (!mounted || mode === "hidden") return null;

  const save = (c: Consent) => {
    storeConsent(c);
    setMode("hidden");
  };
  const toSettings = () => {
    setSel(selectionOf(readStoredConsent()));
    setMode("settings");
  };
  const toggle = (k: CookieCategory) => setSel((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div style={mode === "settings" ? S.wrapBlocking : S.wrap} aria-live="polite">
      {mode === "settings" && <div style={S.backdrop} onClick={() => setMode("banner")} />}
      <div
        role="dialog"
        aria-modal={mode === "settings"}
        aria-label="ความยินยอมคุกกี้"
        style={S.sheet}
      >
        {mode === "banner" ? (
          <>
            <div style={S.head}>
              <span style={{ fontSize: 26, lineHeight: 1 }}>🍪</span>
              <div>
                <h2 style={S.h}>คุกกี้เพื่อประสบการณ์ที่ดีขึ้น</h2>
                <p style={S.p}>
                  ช่วยให้ตะกร้า/ชำระเงินทำงาน และ (เมื่อคุณยินยอม) วิเคราะห์การใช้งาน ·{" "}
                  <Link href="/cookies" style={S.link}>
                    นโยบายคุกกี้
                  </Link>
                </p>
              </div>
            </div>
            <div style={{ ...S.grid2, marginTop: 14 }}>
              <button className="btn btn-default" onClick={() => save(rejectAll(Date.now()))}>
                ปฏิเสธทั้งหมด
              </button>
              <button className="btn btn-primary" onClick={() => save(acceptAll(Date.now()))}>
                ยอมรับทั้งหมด
              </button>
            </div>
            <button type="button" style={S.textlink} onClick={toSettings}>
              ตั้งค่าคุกกี้รายประเภท
            </button>
          </>
        ) : (
          <>
            <div style={S.cHead}>
              <strong style={{ fontSize: 15, fontWeight: 850 }}>ตั้งค่าความยินยอมคุกกี้</strong>
              <Link href="/cookies" style={S.link}>
                นโยบาย
              </Link>
            </div>
            <div style={S.cat}>
              <div>
                <div style={S.catName}>จำเป็นอย่างยิ่ง</div>
                <div style={S.catDesc}>ตะกร้า · ชำระเงิน · ความปลอดภัย</div>
              </div>
              <span style={S.badgeOn}>เปิดเสมอ</span>
            </div>
            {CATS.map((c) => (
              <div style={S.cat} key={c.key}>
                <div>
                  <div style={S.catName}>{c.name}</div>
                  <div style={S.catDesc}>{c.desc}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sel[c.key]}
                  aria-label={c.name}
                  onClick={() => toggle(c.key)}
                  style={swStyle(sel[c.key])}
                >
                  <span style={knobStyle(sel[c.key])} />
                </button>
              </div>
            ))}
            <div style={{ ...S.grid2, marginTop: 14 }}>
              <button className="btn btn-default" onClick={() => save(rejectAll(Date.now()))}>
                ปฏิเสธทั้งหมด
              </button>
              <button className="btn btn-primary" onClick={() => save(acceptAll(Date.now()))}>
                ยอมรับทั้งหมด
              </button>
            </div>
            <button
              className="btn btn-outline"
              style={{ width: "100%", marginTop: 9 }}
              onClick={() => save(makeConsent(sel, Date.now()))}
            >
              บันทึกที่เลือก
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const swStyle = (on: boolean): CSSProperties => ({
  width: 38,
  height: 22,
  borderRadius: 999,
  background: on ? "var(--brand-blue)" : "#d4d0cf",
  border: 0,
  padding: 0,
  position: "relative",
  flex: "0 0 auto",
  cursor: "pointer",
  transition: "background 0.15s",
});

const knobStyle = (on: boolean): CSSProperties => ({
  position: "absolute",
  top: 2,
  left: on ? 18 : 2,
  width: 18,
  height: 18,
  borderRadius: 999,
  background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  transition: "left 0.15s",
});

const S: Record<string, CSSProperties> = {
  wrap: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    pointerEvents: "none", // non-blocking bottom sheet (no cookie wall) — page stays usable
  },
  wrapBlocking: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  backdrop: { position: "absolute", inset: 0, background: "rgba(20,12,12,0.34)" },
  sheet: {
    position: "relative",
    pointerEvents: "auto",
    width: "100%",
    maxWidth: 460,
    margin: "0 auto",
    background: "var(--white)",
    borderRadius: "22px 22px 0 0",
    boxShadow: "0 -12px 30px rgba(0,0,0,0.2)",
    padding: "18px 16px 16px",
    fontFamily: "inherit",
  },
  head: { display: "flex", gap: 11, marginBottom: 12 },
  h: { margin: "0 0 3px", fontSize: 15, fontWeight: 850, color: "var(--gray-dark)" },
  p: { margin: 0, fontSize: 12.5, color: "var(--gray-mid)", lineHeight: 1.5 },
  link: { color: "var(--brand-blue)", textDecoration: "underline", fontWeight: 600 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 },
  textlink: {
    display: "block",
    width: "100%",
    textAlign: "center",
    margin: "11px 0 0",
    padding: 4,
    fontSize: 13,
    fontWeight: 500,
    color: "var(--gray-dark)",
    background: "none",
    border: 0,
    textDecoration: "underline",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  cHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cat: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "9px 0",
    borderTop: "1px solid var(--border-soft, #efeceb)",
  },
  catName: { fontSize: 13, fontWeight: 800, color: "var(--gray-dark)" },
  catDesc: { fontSize: 10.5, color: "var(--gray-mid)", marginTop: 1 },
  badgeOn: {
    fontSize: 10.5,
    fontWeight: 800,
    color: "var(--brand-blue)",
    background: "rgba(1,90,191,0.1)",
    borderRadius: 999,
    padding: "4px 9px",
    flex: "0 0 auto",
  },
};
