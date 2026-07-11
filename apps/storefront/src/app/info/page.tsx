import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "การจัดส่งและการชำระเงิน — AirPlus",
  description: "ข้อมูลการจัดส่ง วิธีชำระเงิน การติดตามคำสั่งซื้อ และการคืนสินค้า ของร้าน AirPlus",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 24 }}>
      <h2 className="t-h3" style={{ margin: "0 0 8px" }}>
        {title}
      </h2>
      <div className="t-body">{children}</div>
    </section>
  );
}

export default function InfoPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="section">
        <h1 className="t-h1" style={{ margin: "0 0 4px" }}>
          การจัดส่งและการชำระเงิน
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          ทุกอย่างที่ควรรู้ก่อนสั่งซื้อ — ไม่มีเงื่อนไขซ่อน
        </p>
      </div>

      <div className="card" style={{ padding: "8px 24px 24px" }}>
        <Section title="การจัดส่ง">
          <ul style={{ margin: 0, paddingLeft: 22 }}>
            <li>แพ็คและจัดส่งภายใน 1-2 วันทำการหลังยืนยันการชำระเงิน</li>
            <li>
              <strong>ส่งฟรีทั่วไทยช่วงเปิดร้าน</strong> — ไม่มีขั้นต่ำ
            </li>
            <li>เมื่อจัดส่งแล้ว เลขพัสดุจะแสดงในหน้าติดตามคำสั่งซื้อ</li>
          </ul>
        </Section>

        <Section title="วิธีชำระเงิน">
          <ul style={{ margin: 0, paddingLeft: 22 }}>
            <li>
              <strong>PromptPay</strong> — สแกน QR จ่ายได้ทันที ระบบแสดง QR หลังยืนยันคำสั่งซื้อ
            </li>
            <li>
              <strong>โอนผ่านบัญชีธนาคาร</strong> — บัญชีร้านค้านิติบุคคล Den Air Service
              (ไม่ใช่บัญชีส่วนตัว)
            </li>
            <li>
              <strong>เก็บเงินปลายทาง (COD)</strong> — จ่ายกับพนักงานส่ง ไม่มีค่าธรรมเนียมเพิ่ม
            </li>
          </ul>
        </Section>

        <Section title="วิธีติดตามคำสั่งซื้อ">
          <p style={{ margin: 0 }}>
            ใช้เลขที่คำสั่งซื้อ (AP-XXXXXXXX) คู่กับเบอร์โทรศัพท์ที่ใช้สั่งซื้อ ที่หน้า{" "}
            <Link href="/orders" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              ติดตามคำสั่งซื้อ
            </Link>{" "}
            ได้ตลอดเวลา หรือเข้าสู่ระบบเพื่อดูประวัติคำสั่งซื้อทั้งหมดในหน้า{" "}
            <Link href="/account" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              บัญชีของฉัน
            </Link>
          </p>
        </Section>

        <Section title="การเปลี่ยน/คืนสินค้า">
          <p style={{ margin: 0 }}>
            หากสินค้ามีปัญหา ไม่ตรงรุ่น หรือได้รับสินค้าผิด กรุณาติดต่อร้าน
            <strong>ภายใน 7 วัน</strong>นับจากวันที่ได้รับสินค้า
            พร้อมเลขที่คำสั่งซื้อและรูปถ่ายสินค้า ทางร้านยินดีดูแลทุกกรณี
          </p>
        </Section>
      </div>
    </div>
  );
}
