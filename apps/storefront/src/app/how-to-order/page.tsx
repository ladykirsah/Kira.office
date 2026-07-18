// DRAFT — customer-facing "how to order" guide. Describes the real checkout flow (OTP login,
// address, payment options, slip upload, tracking). Owner to confirm before launch.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ขั้นตอนการสั่งสินค้า — AirPlus",
  description: "วิธีสั่งซื้อสินค้ากับร้าน AirPlus ตั้งแต่เลือกสินค้าจนถึงติดตามพัสดุ",
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 24, display: "flex", gap: 12 }}>
      <span
        aria-hidden
        style={{
          flex: "0 0 auto",
          width: 28,
          height: 28,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--brand)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {n}
      </span>
      <div style={{ flex: 1 }}>
        <h2 className="t-h3" style={{ margin: "2px 0 6px" }}>
          {title}
        </h2>
        <div className="t-body">{children}</div>
      </div>
    </section>
  );
}

export default function HowToOrderPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="section">
        <h1 className="t-h1" style={{ margin: "0 0 4px" }}>
          ขั้นตอนการสั่งสินค้า
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          สั่งซื้อง่าย ๆ ไม่กี่ขั้นตอน ตั้งแต่เลือกสินค้าจนถึงติดตามพัสดุ
        </p>
      </div>

      <div className="card" style={{ padding: "8px 24px 24px" }}>
        <Step n={1} title="เลือกสินค้าและใส่ตะกร้า">
          <p style={{ margin: 0 }}>
            ค้นหาอะไหล่ที่ตรงกับรุ่นรถของท่าน กดดูรายละเอียดสินค้า แล้วกด{" "}
            <strong>“ใส่ตะกร้า”</strong> หรือ <strong>“ซื้อเลยตอนนี้”</strong> ได้ทันที
          </p>
        </Step>

        <Step n={2} title="เข้าสู่ระบบด้วยเบอร์โทร">
          <p style={{ margin: 0 }}>
            ก่อนสั่งซื้อ ท่านต้องยืนยันตัวตนด้วย <strong>เบอร์โทรศัพท์และรหัส OTP</strong> ที่ส่งทาง
            SMS (สมาชิกใหม่กรอกชื่อและวันเกิดเพื่อยืนยันอายุ 20 ปีบริบูรณ์)
          </p>
        </Step>

        <Step n={3} title="กรอกที่อยู่จัดส่ง">
          <p style={{ margin: 0 }}>
            ระบุชื่อผู้รับ เบอร์โทร และที่อยู่สำหรับจัดส่ง
            ท่านบันทึกที่อยู่ไว้ในบัญชีเพื่อใช้ครั้งต่อไปได้
          </p>
        </Step>

        <Step n={4} title="เลือกวิธีชำระเงิน">
          <p style={{ margin: 0 }}>เลือกได้ตามสะดวก:</p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 22 }}>
            <li>
              <strong>พร้อมเพย์ (PromptPay QR)</strong> — สแกนจ่ายผ่านแอปธนาคาร แล้วแนบสลิป
            </li>
            <li>
              <strong>โอนเงินผ่านธนาคาร</strong> — โอนแล้วแนบสลิปเพื่อยืนยัน
            </li>
            <li>
              <strong>เก็บเงินปลายทาง (COD)</strong> — ชำระกับพนักงานส่งของเมื่อรับสินค้า
            </li>
          </ul>
        </Step>

        <Step n={5} title="ยืนยันคำสั่งซื้อและชำระเงิน">
          <p style={{ margin: 0 }}>
            ตรวจสอบรายการและยอดรวมอีกครั้ง แล้วกดยืนยัน หากเลือกพร้อมเพย์/โอนเงิน ให้ชำระและ
            <strong>แนบสลิป</strong> เพื่อให้ร้านตรวจสอบการชำระเงิน
          </p>
        </Step>

        <Step n={6} title="ติดตามสถานะและรับสินค้า">
          <p style={{ margin: 0 }}>
            ติดตามสถานะคำสั่งซื้อและเลขพัสดุได้ที่หน้า <strong>บัญชีของฉัน → คำสั่งซื้อ</strong>{" "}
            หรือค้นหาด้วย <strong>เลขที่คำสั่งซื้อ + เบอร์โทร</strong>
          </p>
        </Step>

        <section style={{ marginTop: 28 }}>
          <div className="t-body">
            <p className="muted" style={{ margin: 0 }}>
              เปลี่ยนใจ ยกเลิก หรือสินค้ามีปัญหา? ดูขั้นตอนได้ที่{" "}
              <a href="/returns" style={{ color: "var(--brand-blue)", fontWeight: 600 }}>
                การคืน ยกเลิก เคลม
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
