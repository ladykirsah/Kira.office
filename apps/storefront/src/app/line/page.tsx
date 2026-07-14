import type { Metadata } from "next";

export const metadata: Metadata = { title: "แอดไลน์ AirPlus — ช่วยเหลือ" };

/**
 * LINE contact page — the single target for every "ช่วยหาอะไหล่ / ช่วยเหลือ / เพิ่มเพื่อน LINE" action.
 * Shows the LINE OA add-friend QR to scan (public/line-oa-qr.png, provided by the owner).
 * TODO(owner): once the add-friend deep link (`https://lin.ee/<code>` or `@<basic-id>`) is provided,
 * add a green "เปิด LINE" button here so mobile shoppers add the OA in one tap instead of scanning.
 */
export default function LinePage() {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <section className="section" style={{ marginBottom: 16 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)" }}>
          💬 ช่วยเหลือ · LINE
        </div>
        <h1 className="t-h1" style={{ color: "var(--gray-dark)", margin: "6px 0 8px" }}>
          แอดไลน์ AirPlus
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          สอบถาม แจ้งปัญหา หรือช่วยหาอะไหล่ — ทักได้เลยทาง LINE
        </p>
      </section>

      <div
        className="card"
        style={{
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/line-oa-qr.png"
          alt="LINE Official Account QR — AirPlus (Den Air Service)"
          width={220}
          height={220}
          style={{ borderRadius: 12, background: "#fff" }}
        />
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--gray-dark)" }}>
          สแกน QR เพื่อเพิ่มเพื่อน
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          เปิดแอป LINE › เพิ่มเพื่อน › สแกน QR
          <br />
          แล้วทักสอบถาม หรือส่งรุ่นรถ / รูปอะไหล่มาได้เลย
        </p>
      </div>
    </div>
  );
}
