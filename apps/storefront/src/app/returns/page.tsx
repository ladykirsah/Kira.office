// DRAFT — customer-facing returns/cancellation/claim page for owner + lawyer review BEFORE launch.
// Content mirrors docs/policies/claim-returns-warranty-policy.md and Terms §6/§8. Placeholders the
// owner must confirm: the exact return/warranty window per product category (shown on each PDP once
// that data field exists), and the contact channel. Wording not yet reviewed by a lawyer.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "การคืน ยกเลิก เคลม — AirPlus",
  description: "ขั้นตอนการยกเลิกคำสั่งซื้อ การคืนสินค้า และการเคลมประกันของร้าน AirPlus",
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

export default function ReturnsPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="section">
        <h1 className="t-h1" style={{ margin: "0 0 4px" }}>
          การคืน ยกเลิก เคลม
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          AirPlus (ดำเนินการโดย Den Air Service) — นโยบายการยกเลิกคำสั่งซื้อ การคืนสินค้า
          และการรับประกัน
        </p>
      </div>

      <div className="card" style={{ padding: "8px 24px 24px" }}>
        <Section title="1. ยกเลิกคำสั่งซื้อ (ก่อนได้รับสินค้า)">
          <ul style={{ margin: 0, paddingLeft: 22 }}>
            <li>
              <strong>ยังไม่ได้ชำระเงิน</strong> — กดยกเลิกได้ทันที ระบบจะยกเลิกให้อัตโนมัติ
              ไม่มีค่าใช้จ่าย
            </li>
            <li>
              <strong>ชำระเงินแล้ว แต่ยังไม่ได้รับสินค้า (อยู่ระหว่างจัดส่ง)</strong> — กดยกเลิก
              และแจ้งเลขที่บัญชีธนาคาร ท่านจะได้รับเงินคืนภายใน 2-3 วันทำการ
              <strong>หลังจากสินค้าถูกส่งกลับมาถึงร้าน</strong>
            </li>
          </ul>
        </Section>

        <Section title="2. การคืน / เคลม (หลังได้รับสินค้า)">
          <p style={{ margin: 0 }}>
            ระยะเวลาการคืน/เคลม/รับประกันของสินค้าแต่ละชิ้น
            <strong>
              แตกต่างกันตามหมวดหมู่สินค้า และจะระบุไว้ในหน้ารายละเอียดสินค้านั้น ๆ
            </strong>{" "}
            ระยะเวลานี้ครอบคลุมทั้งการคืนสินค้าและการเคลมประกันในช่วงเวลาเดียวกัน
          </p>
        </Section>

        <Section title="3. สิ่งที่ครอบคลุมและไม่ครอบคลุม">
          <p style={{ margin: 0, fontWeight: 600 }}>ครอบคลุม</p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 22 }}>
            <li>สินค้าชำรุด/มีตำหนิจากโรงงาน</li>
            <li>
              สินค้าเสียหายระหว่างการขนส่ง (เรารับผิดชอบโดยตรง ไม่ว่าจะเกิดจากการบรรจุหรือผู้ขนส่ง)
            </li>
            <li>สินค้าไม่ตรงตามที่แจ้งไว้ในหน้ารายละเอียดสินค้า</li>
          </ul>
          <p style={{ margin: "12px 0 0", fontWeight: 600 }}>ไม่ครอบคลุม</p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 22 }}>
            <li>
              ลูกค้าเลือกสินค้าผิดรุ่นรถด้วยตนเอง (ถือเป็นกรณี “เปลี่ยนใจ”
              หากยังอยู่ในระยะเวลาคืนสินค้า)
            </li>
            <li>ความเสียหายจากการติดตั้ง/ใช้งานผิดวิธีโดยลูกค้าหรือช่างภายนอก</li>
          </ul>
        </Section>

        <Section title="4. ขั้นตอนการเปิดเรื่องคืน/เคลม">
          <ol style={{ margin: 0, paddingLeft: 22 }}>
            <li>
              กดปุ่ม <strong>ยกเลิก/เคลมสินค้า</strong> ในคำสั่งซื้อ และเลือกเหตุผล:{" "}
              <strong>เปลี่ยนใจ</strong> หรือ <strong>สินค้าชำรุด/เสียหาย</strong>
            </li>
            <li>
              <strong>แนบรูปถ่ายปัญหาที่พบ</strong> (และวิดีโอสั้น ๆ หากสงสัยว่าเสียหายจากการขนส่ง)
              — จำเป็นต้องแนบเพื่อเปิดเรื่อง
            </li>
            <li>
              รับที่อยู่ร้านเพื่อส่งสินค้าคืน และแจ้งเลขที่บัญชีธนาคารสำหรับรับเงินคืน (หากมี)
            </li>
          </ol>
          <p style={{ margin: "10px 0 0" }}>
            <strong>ค่าจัดส่งไป-กลับ:</strong> กรณีเปลี่ยนใจ ลูกค้ารับผิดชอบ / กรณีสินค้าชำรุด
            ร้านรับผิดชอบ (แม้ผลตรวจสอบภายหลังจะต่างจากที่แจ้ง
            ร้านจะไม่เรียกเก็บค่าจัดส่งที่จ่ายไปแล้วคืนจากลูกค้า)
          </p>
        </Section>

        <Section title="5. การตรวจสอบโดยช่าง">
          <p style={{ margin: 0 }}>
            เมื่อสินค้าถึงร้าน ช่างของเราจะตรวจสอบ
            โดยบันทึกขั้นตอนไว้ตั้งแต่การแกะกล่องเพื่อเป็นหลักฐาน ผลการพิจารณามี 3 แบบ:
          </p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 22 }}>
            <li>
              <strong>อนุมัติเต็มจำนวน (100%)</strong> — เข้าเงื่อนไข
              ท่านเลือกได้ระหว่างคืนเงินหรือเปลี่ยนสินค้าใหม่ (ดูข้อ 6)
            </li>
            <li>
              <strong>อนุมัติบางส่วน</strong> — คืนเงินไม่เต็มจำนวน
              โดยแจ้งเปอร์เซ็นต์และเหตุผลเป็นกรณีไป
            </li>
            <li>
              <strong>ไม่อนุมัติ (0%)</strong> — ไม่เข้าเงื่อนไข พร้อมแจ้งเหตุผล
              ร้านจะจัดส่งสินค้ากลับคืนให้ท่านโดยไม่มีการคืนเงิน
            </li>
          </ul>
        </Section>

        <Section title="6. ทางเลือกเมื่อเคลมได้รับการอนุมัติเต็มจำนวน">
          <p style={{ margin: 0 }}>ท่านเลือกได้ระหว่าง:</p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 22 }}>
            <li>รับเงินคืนเต็มจำนวน หรือ</li>
            <li>
              รับสินค้าใหม่ทดแทน — ต้องเป็นสินค้ารุ่น/รายละเอียดเดียวกันทุกประการ
              ไม่สามารถเปลี่ยนเป็นสินค้าอื่นหรือสเปกอื่นได้
            </li>
          </ul>
        </Section>

        <Section title="7. ระยะเวลาคืนเงิน">
          <p style={{ margin: 0 }}>
            เมื่อได้ผลการพิจารณาแล้ว ท่านจะได้รับเงินคืนผ่านบัญชีที่แจ้งไว้ภายใน 2-3 วันทำการ
          </p>
        </Section>

        <Section title="8. ติดต่อเรา">
          <ul style={{ margin: 0, paddingLeft: 22 }}>
            <li>บริษัท เด่นแอร์ เซอร์วิส จำกัด</li>
            <li>88 หมู่ 7 ต.กังแอน ถ.สุรินทร์-ช่องจอม อ.ปราสาท จ.สุรินทร์ 32140</li>
            <li>โทร: 044-551-991, 061-939-6144</li>
            <li>LINE OA: @811gvdun</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
