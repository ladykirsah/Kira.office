// DRAFT — Cookie Policy for owner review BEFORE launch. Source of truth is
// docs/policies/cookie-policy.md (policy branch); keep this page in step with it. Placeholders:
// real domain + lawyer review pending. Publishing is now unblocked because the consent banner
// described in §3 exists (CookieConsent component).
import type { Metadata } from "next";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";

export const metadata: Metadata = {
  title: "นโยบายคุกกี้ — AirPlus",
  description: "นโยบายการใช้คุกกี้ของร้าน AirPlus (ดำเนินการโดย บริษัท เด่นแอร์ เซอร์วิส จำกัด)",
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

const th = { textAlign: "left" as const, padding: "8px 10px", fontWeight: 800, fontSize: 13 };
const td = { padding: "8px 10px", verticalAlign: "top" as const, fontSize: 13 };

export default function CookiePolicyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="section">
        <h1 className="t-h1" style={{ margin: "0 0 4px" }}>
          นโยบายคุกกี้
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          AirPlus (ดำเนินการโดย บริษัท เด่นแอร์ เซอร์วิส จำกัด) — ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล
          พ.ศ. 2562 (PDPA) และแนวปฏิบัติ สคส. 2565
        </p>
      </div>

      <div className="card" style={{ padding: "8px 24px 24px" }}>
        <Section title="1. คุกกี้คืออะไร">
          <p style={{ margin: 0 }}>
            คุกกี้คือไฟล์ข้อความขนาดเล็กที่เว็บไซต์จัดเก็บไว้ในอุปกรณ์ของท่านเมื่อเข้าชมเว็บไซต์
            ใช้เพื่อจดจำการตั้งค่า พฤติกรรมการใช้งาน และช่วยให้เว็บไซต์ทำงานได้อย่างถูกต้อง
          </p>
        </Section>

        <Section title="2. ประเภทคุกกี้ที่เราใช้">
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 460 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--paper)" }}>
                  <th style={th}>ประเภท</th>
                  <th style={th}>วัตถุประสงค์</th>
                  <th style={th}>ฐานทางกฎหมาย</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--paper)" }}>
                  <td style={td}>
                    <b>จำเป็นอย่างยิ่ง</b>
                  </td>
                  <td style={td}>ตะกร้าสินค้า, การเข้าสู่ระบบ, ขั้นตอนชำระเงิน, ความปลอดภัย</td>
                  <td style={td}>ปฏิบัติตามสัญญา (ม.24) — ไม่ต้องขอความยินยอม</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--paper)" }}>
                  <td style={td}>
                    <b>วิเคราะห์การใช้งาน</b>
                  </td>
                  <td style={td}>วัดจำนวนผู้เข้าชม, พฤติกรรมการใช้งาน, ปรับปรุงเว็บไซต์</td>
                  <td style={td}>ความยินยอม (ม.19)</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--paper)" }}>
                  <td style={td}>
                    <b>การตลาด/โฆษณา</b>
                  </td>
                  <td style={td}>ติดตามผลโฆษณา, รีทาร์เก็ต, สร้าง customer persona</td>
                  <td style={td}>ความยินยอมแบบเจาะจง (ม.19)</td>
                </tr>
                <tr>
                  <td style={td}>
                    <b>บริการบุคคลที่สาม</b>
                  </td>
                  <td style={td}>วิดเจ็ต LINE OA, ระบบชำระเงิน (PromptPay / SlipOK)</td>
                  <td style={td}>ความยินยอม หรือความจำเป็นในการให้บริการที่ท่านร้องขอ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="3. การขอความยินยอม">
          <ul style={{ margin: 0, paddingLeft: 22 }}>
            <li>
              เมื่อเข้าเว็บไซต์ครั้งแรก จะมีแบนเนอร์ขอความยินยอมปรากฏขึ้น
              โดยคุกกี้ที่ไม่จำเป็นจะยังไม่ทำงานจนกว่าท่านจะเลือก
            </li>
            <li>
              ท่านเลือกได้ทั้ง <b>“ยอมรับทั้งหมด”</b>, <b>“ปฏิเสธทั้งหมด”</b>{" "}
              (ปุ่มทั้งสองโดดเด่นเท่ากัน) หรือ <b>“ตั้งค่า”</b> เพื่อเลือกยอมรับเป็นรายประเภท
            </li>
            <li>คุกกี้ที่จำเป็นอย่างยิ่งจะทำงานเสมอและไม่สามารถปิดได้</li>
            <li>ระบบจะบันทึกการให้ความยินยอมของท่านพร้อมวันเวลาเพื่อเป็นหลักฐานตามกฎหมาย</li>
            <li>
              ท่านเปลี่ยนแปลงการตั้งค่าได้ทุกเมื่อผ่านลิงก์ <b>“ตั้งค่าคุกกี้”</b> ที่ท้ายเว็บไซต์
              หรือปุ่มด้านล่างนี้
            </li>
          </ul>
          <div style={{ marginTop: 14 }}>
            <CookieSettingsButton />
          </div>
        </Section>

        <Section title="4. ระยะเวลาการจัดเก็บ">
          <p style={{ margin: 0 }}>
            คุกกี้เซสชัน/ตะกร้าจัดเก็บจนกว่าจะปิดเบราว์เซอร์ ส่วนคุกกี้วิเคราะห์/การตลาด
            (เมื่อติดตั้ง) จะมีอายุตามค่ามาตรฐานของผู้ให้บริการแต่ละราย เช่น Google Analytics ~2 ปี,
            Meta Pixel ~90 วัน — จะตรวจสอบและระบุให้ชัดเจนเมื่อมีการติดตั้งจริง
          </p>
        </Section>

        <Section title="5. การเปิดเผยข้อมูลแก่บุคคลที่สาม">
          <p style={{ margin: 0 }}>
            เมื่อท่านยินยอมให้ใช้คุกกี้เพื่อการวิเคราะห์และการตลาด ข้อมูลบางส่วนอาจถูกส่งไปยัง
            Google, Meta, TikTok และ LINE ซึ่งอาจประมวลผลนอกประเทศไทย
            เราจะเลือกผู้ให้บริการที่มีมาตรการคุ้มครองข้อมูลที่เหมาะสมตามที่กฎหมายกำหนด
          </p>
        </Section>

        <Section title="6. สิทธิของท่าน">
          <p style={{ margin: 0 }}>
            ท่านมีสิทธิถอนความยินยอมได้ทุกเมื่อ
            โดยไม่กระทบต่อความชอบด้วยกฎหมายของการประมวลผลที่ทำไปแล้วก่อนการถอนความยินยอม
            รายละเอียดสิทธิทั้งหมดระบุไว้ใน{" "}
            <a href="/privacy" style={{ color: "var(--brand-blue)", textDecoration: "underline" }}>
              นโยบายความเป็นส่วนตัว
            </a>
          </p>
        </Section>

        <Section title="7. ติดต่อเรา">
          <p style={{ margin: 0, lineHeight: 1.8 }}>
            บริษัท เด่นแอร์ เซอร์วิส จำกัด
            <br />
            โทร: 044-551-991, 061-939-6144
            <br />
            อีเมล: air.plus.seller@gmail.com · LINE OA: @811gvdun
          </p>
        </Section>
      </div>
    </div>
  );
}
