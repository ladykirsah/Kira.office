import type { Metadata } from "next";
import Link from "next/link";
import { FAQ_SECTIONS, faqPageJsonLd } from "@/lib/faq";
import { serializeJsonLd } from "@/lib/seo";

const TITLE = "คำถามที่พบบ่อย (FAQ) — AirPlus";
const DESC =
  "คำถามที่พบบ่อยเกี่ยวกับการสั่งซื้อ จัดส่ง ชำระเงิน รับประกัน การคืนสินค้า และการเลือกอะไหล่แอร์รถยนต์ให้ตรงรุ่นรถ กับร้าน AirPlus by Den Air Service";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/faq" },
  openGraph: { title: TITLE, description: DESC, url: "/faq", type: "website" },
};

/**
 * FAQ, sectioned by category. Answers live in the DOM (a <details> collapses visually but keeps the
 * text crawlable), and the whole set is emitted as one FAQPage JSON-LD for answer engines + voice.
 */
export default function FaqPage() {
  const ld = faqPageJsonLd(FAQ_SECTIONS);
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }}
      />

      <div style={{ marginBottom: 8 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 6 }}>
          ❓ ช่วยเหลือ · FAQ
        </div>
        <h1 className="t-h1" style={{ margin: 0, color: "var(--gray-dark)" }}>
          คำถามที่พบบ่อย
        </h1>
      </div>

      {FAQ_SECTIONS.map((s) => (
        <section key={s.titleEn} className="section">
          <h2 className="t-h2" style={{ color: "var(--gray-dark)", margin: "0 0 12px" }}>
            {s.title}{" "}
            <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              {s.titleEn}
            </span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {s.items.map((it, i) => (
              <details key={i} className="card" style={{ padding: "13px 16px" }}>
                <summary style={{ fontWeight: 700, cursor: "pointer", color: "var(--gray-dark)" }}>
                  {it.q}
                </summary>
                <p className="muted" style={{ margin: "10px 0 0", lineHeight: 1.75 }}>
                  {it.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="muted" style={{ marginTop: 22, fontSize: 14 }}>
        ยังมีคำถามอื่น? <Link href="/info">ดูข้อมูลการจัดส่ง &amp; ชำระเงิน</Link>{" "}
        หรือทักแชทหาร้านได้เลย
      </p>
    </div>
  );
}
