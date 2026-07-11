// DRAFT — PDPA privacy notice for owner review BEFORE launch. Placeholders: contact channel
// (LINE/phone) must be confirmed by the owner; wording has not been reviewed by a lawyer.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว — AirPlus",
  description: "นโยบายความเป็นส่วนตัวของร้าน AirPlus (ดำเนินการโดย Den Air Service)",
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

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="section">
        <h1 className="t-h1" style={{ margin: "0 0 4px" }}>
          นโยบายความเป็นส่วนตัว
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          AirPlus (ดำเนินการโดย Den Air Service) — ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
          (PDPA)
        </p>
      </div>

      <div className="card" style={{ padding: "8px 24px 24px" }}>
        <Section title="1. ข้อมูลที่เราจัดเก็บ">
          <p style={{ margin: 0 }}>
            เมื่อท่านสมัครสมาชิกหรือสั่งซื้อสินค้ากับเรา เราจัดเก็บข้อมูลดังนี้
          </p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 22 }}>
            <li>ชื่อ-นามสกุล</li>
            <li>เบอร์โทรศัพท์ (ใช้เป็นบัญชีสมาชิกและยืนยันตัวตนด้วยรหัส OTP)</li>
            <li>ที่อยู่จัดส่งสินค้า</li>
            <li>ประวัติคำสั่งซื้อและการชำระเงิน</li>
          </ul>
        </Section>

        <Section title="2. วัตถุประสงค์ในการใช้ข้อมูล">
          <ul style={{ margin: 0, paddingLeft: 22 }}>
            <li>จัดการคำสั่งซื้อและการชำระเงิน</li>
            <li>จัดส่งสินค้าไปยังที่อยู่ที่ท่านระบุ</li>
            <li>ติดต่อท่านเกี่ยวกับคำสั่งซื้อ เช่น ยืนยันการชำระเงิน แจ้งเลขพัสดุ</li>
            <li>ให้บริการหลังการขาย เช่น การเปลี่ยน/คืนสินค้า</li>
          </ul>
          <p style={{ margin: "6px 0 0" }}>
            เราใช้ข้อมูลเท่าที่จำเป็นต่อการให้บริการเท่านั้น
            และไม่นำข้อมูลไปใช้เพื่อวัตถุประสงค์อื่นโดยไม่ได้รับความยินยอมจากท่าน
          </p>
        </Section>

        <Section title="3. ระยะเวลาการจัดเก็บ">
          <p style={{ margin: 0 }}>
            เราเก็บข้อมูลบัญชีและประวัติคำสั่งซื้อตลอดระยะเวลาที่ท่านยังเป็นสมาชิก
            และเก็บหลักฐานทางบัญชีตามระยะเวลาที่กฎหมายกำหนด
            หลังจากนั้นข้อมูลจะถูกลบหรือทำให้ไม่สามารถระบุตัวตนได้
          </p>
        </Section>

        <Section title="4. สิทธิของเจ้าของข้อมูล">
          <p style={{ margin: 0 }}>
            ท่านมีสิทธิขอเข้าถึง ขอแก้ไข หรือขอลบข้อมูลส่วนบุคคลของท่านได้ตลอดเวลา
            โดยติดต่อร้านผ่านช่องทางติดต่อด้านล่าง เราจะดำเนินการภายในระยะเวลาที่กฎหมายกำหนด
          </p>
        </Section>

        <Section title="5. การเปิดเผยข้อมูลต่อบุคคลที่สาม">
          <p style={{ margin: 0 }}>
            เรา<strong>ไม่ขาย</strong>ข้อมูลส่วนบุคคลของท่านให้บุคคลที่สามในทุกกรณี
            ข้อมูลจะถูกเปิดเผยเฉพาะเท่าที่จำเป็นต่อการให้บริการ เช่น ชื่อ เบอร์โทร
            และที่อยู่ที่ส่งให้บริษัทขนส่งเพื่อจัดส่งสินค้า
          </p>
        </Section>

        <Section title="6. คุกกี้และเซสชัน">
          <p style={{ margin: 0 }}>
            เว็บไซต์นี้ใช้คุกกี้ที่จำเป็นต่อการทำงานเท่านั้น ได้แก่
            คุกกี้เซสชันสำหรับจดจำการเข้าสู่ระบบของท่าน
            เราไม่ใช้คุกกี้เพื่อการโฆษณาหรือติดตามพฤติกรรมข้ามเว็บไซต์
          </p>
        </Section>

        <Section title="7. ช่องทางติดต่อ">
          <p style={{ margin: 0 }}>
            หากมีข้อสงสัยเกี่ยวกับข้อมูลส่วนบุคคล หรือต้องการใช้สิทธิตามข้อ 4 กรุณาติดต่อร้าน Den
            Air Service
            {/* TODO(owner): ยืนยันช่องทางติดต่อจริงก่อนเปิดตัว (LINE / เบอร์โทร / อีเมล) */}{" "}
            ผ่านช่องทางที่ระบุไว้บนหน้าร้าน
          </p>
        </Section>
      </div>
    </div>
  );
}
