# นโยบายการจัดการข้อมูลส่วนบุคคลภายในองค์กร (Internal Data-Handling Policy)

**สำหรับ:** เจ้าของร้านและพนักงานของ บริษัท เด่นแอร์ เซอร์วิส จำกัด (ครอบคลุมทั้งหน้าร้าน เด่นแอร์ เซอร์วิส และร้านออนไลน์ AirPlus)
**เอกสารนี้เป็นเอกสารภายใน ไม่เผยแพร่แก่ลูกค้า**
**ปรับปรุงล่าสุด:** 16 July 2026

---

## ฉบับภาษาไทย

### 1. วัตถุประสงค์และขอบเขต

เอกสารนี้กำหนดวิธีที่พนักงานและเจ้าของร้านต้องปฏิบัติต่อข้อมูลส่วนบุคคลของลูกค้า ทั้งจากช่องทางหน้าร้าน (เด่นแอร์ เซอร์วิส) และช่องทางออนไลน์ (AirPlus) เพื่อให้สอดคล้องกับพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) ใช้บังคับกับทุกคนที่มีสิทธิ์เข้าถึงระบบ Kira.office หรือเอกสารลูกค้าใด ๆ

### 2. ข้อมูลที่เราเก็บ และเก็บไว้ที่ไหน

**ช่องทางหน้าร้าน (เด่นแอร์ เซอร์วิส):**
บิลกระดาษของลูกค้าจะถูกคัดลอกลง Google Sheet แบบฟอร์มตายตัว (เฉพาะลูกค้าหน้าร้านเท่านั้น) ประกอบด้วย: ทะเบียนรถ, จังหวัด, ชื่อลูกค้า, เบอร์โทร, รุ่นรถ, หมายเหตุ, วันที่เข้ารับบริการ, รายการบริการ จากนั้นจึงนำเข้าสู่ระบบ Kira.office แบบถาวร

**ช่องทางออนไลน์ (AirPlus):**
ข้อมูลบันทึกเข้าสู่ Kira.office โดยตรง ไม่ผ่านขั้นตอนกระดาษ/ชีท ประกอบด้วย: ชื่อผู้ใช้ (กรอกเอง), เบอร์โทร, ที่อยู่จัดส่ง (กรอกเอง), ประวัติคำสั่งซื้อ, **คะแนนความน่าเชื่อถือที่ระบบคำนวณ** (ใช้พิจารณาระดับสมาชิก ความถี่ในการซื้อ และความเสี่ยงด้านการชำระเงิน — ดูข้อ 3), และวันเกิด **เฉพาะกรณีลูกค้าสมัครรับสิทธิพิเศษวันเกิดเท่านั้น**

**เราไม่เก็บ** เลขบัตรเครดิต/เดบิต หรือสำเนาบัตรประชาชนของลูกค้า ในทั้งสองช่องทาง

### 3. คะแนนความน่าเชื่อถือ (Credit/Trust Score) และการใช้งาน

ระบบคำนวณคะแนนของลูกค้าแต่ละราย (จากประวัติการซื้อ/ความถี่) เพื่อใช้พิจารณาว่าจะอนุญาตให้เลือกวิธีชำระเงินแบบเก็บเงินปลายทาง (COD) ได้หรือไม่ — **คะแนนต่ำจะถูกปฏิเสธ COD โดยอัตโนมัติ**

นี่คือกระบวนการที่มีผลกระทบโดยตรงต่อลูกค้า จึงต้อง**เปิดเผยไว้ในนโยบายความเป็นส่วนตัว (Privacy Notice)** ที่ลูกค้าเห็น ไม่ใช่แค่เอกสารภายในฉบับนี้

### 4. ระดับการเข้าถึงข้อมูล

| ระดับ | ใคร | เข้าถึงอะไรได้ |
|---|---|---|
| **Super Admin** | เจ้าของร้าน (บัญชีเดียว ใช้ร่วมกันโดย 2 คน) | เข้าถึงข้อมูลลูกค้าทั้งหมดทั้งสองช่องทาง เพื่อบริการลูกค้า (แก้ไขข้อผิดพลาด, เปลี่ยนแปลงตามคำขอ, ตรวจสอบประวัติตามคำขอ) รวมถึงเป็นระดับเดียวที่เห็นคะแนนความน่าเชื่อถือดิบ |
| **Admin** | พนักงานทั่วไป (รวมพนักงานจัดส่ง) | เห็นเฉพาะฉลากจัดส่งและรายการสินค้าที่สั่งซื้อ + ผลลัพธ์ COD อนุมัติ/ปฏิเสธ (แต่ไม่เห็นคะแนนดิบที่นำมาคำนวณ) พนักงานจัดส่งเข้าถึงข้อมูลลูกค้าได้เฉพาะช่วงจัดส่งเท่านั้น |
| **Mechanic** | ช่างซ่อม | ไม่สามารถเข้าถึงข้อมูลลูกค้าใด ๆ ได้เลย |

### 5. การเปิดเผยข้อมูลแก่บุคคลที่สาม

| ผู้รับข้อมูล | ข้อมูลที่ได้รับ | สถานะ |
|---|---|---|
| Kerry / Flash Express / ไปรษณีย์ไทย | ชื่อ, ที่อยู่, เบอร์โทร (บนฉลากจัดส่ง) | ใช้งานจริง |
| ผู้ให้บริการ SMS OTP | เบอร์โทร (สำหรับยืนยันตัวตนสมัคร/เข้าสู่ระบบ) | ใช้งานจริง — ยังไม่ระบุชื่อผู้ให้บริการ |
| SlipOK (ตรวจสอบสลิปโอนเงิน) | ข้อมูล QR บนสลิป + จำนวนเงิน (ไม่รวมข้อมูลลูกค้า) | **ยังไม่เปิดใช้งาน** — มีโค้ดรองรับแล้วแต่ยังไม่ได้สร้างบัญชี SlipOK |
| Kira.office (POS) | — | ไม่ใช่บุคคลที่สาม ดำเนินการภายในบริษัทเองทั้งหมด |

### 6. การเก็บรักษาและการลบข้อมูล

เราเก็บข้อมูลลูกค้าไว้ไม่มีกำหนด และจะลบเมื่อลูกค้าร้องขอเท่านั้น อย่างไรก็ตาม เอกสารบางประเภท (เช่น ใบเสร็จ/ใบกำกับภาษี) อาจต้องเก็บไว้ตามระยะเวลาที่กฎหมายภาษีกำหนด แม้ลูกค้าจะร้องขอให้ลบก็ตาม (ควรตรวจสอบระยะเวลาที่แน่นอนกับนักบัญชีของร้าน)

### 7. ขั้นตอนเมื่อเกิดเหตุข้อมูลรั่วไหล

1. ผู้ที่พบเหตุ (อุปกรณ์หาย, มีคนเข้าถึงระบบโดยไม่ได้รับอนุญาต, ข้อมูลรั่วไหล) แจ้ง Super Admin ทันที
2. Super Admin ระงับเหตุโดยเร็ว — เพิกถอนสิทธิ์เข้าถึง, เปลี่ยนรหัสผ่านบัญชีที่ใช้ร่วมกัน, กู้คืน/ลบข้อมูลจากอุปกรณ์ที่สูญหาย
3. ประเมินว่าข้อมูลใดรั่วไหล ลูกค้ากี่รายได้รับผลกระทบ และมีความเสี่ยงจริงต่อลูกค้าหรือไม่
4. หากมีความเสี่ยงจริง — แจ้ง สคส. (PDPC) ภายใน 72 ชั่วโมง (หรือช้าสุดไม่เกิน 15 วัน พร้อมเหตุผล) และแจ้งลูกค้าที่ได้รับผลกระทบโดยตรงหากความเสี่ยงสูง
5. บันทึกเหตุการณ์และวิธีจัดการไว้เป็นหลักฐาน แม้จะสั้น ๆ ก็ตาม

### 8. ข้อปฏิบัติของพนักงาน

- ห้ามนำข้อมูลลูกค้าไปใช้นอกเหนือวัตถุประสงค์ที่ระบุไว้
- ห้ามคัดลอก/ถ่ายภาพข้อมูลลูกค้าออกจากระบบไปยังอุปกรณ์ส่วนตัว
- หากสงสัยว่ามีเหตุข้อมูลรั่วไหล ให้แจ้ง Super Admin ทันที ไม่ต้องรอประเมินเองก่อน

### 9. การทบทวนนโยบาย

ทบทวนเอกสารนี้เมื่อมีการเปลี่ยนแปลงระบบ ผู้ให้บริการภายนอก หรือกระบวนการทำงานที่เกี่ยวข้องกับข้อมูลลูกค้า

---

## English Version

### 1. Purpose and Scope

This document sets out how owners and staff must handle customer personal data across both the on-site shop (Den Air Service) and the online store (AirPlus), in line with the Personal Data Protection Act B.E. 2562 (PDPA). It applies to everyone with access to Kira.office or any customer records.

### 2. What We Collect and Where It Lives

**On-site channel (Den Air Service):** paper bills are transcribed into a fixed-template Google Sheet (Den Air Service customers only) — license plate, plate province, customer name, phone, car model, notes, visit date, service description — then imported permanently into Kira.office.

**Online channel (AirPlus):** recorded directly into Kira.office, no paper/sheet step. Includes: self-input name, phone, self-input delivery address, order history, a **system-calculated trust/credit score** (used for loyalty tier, purchase frequency, and payment risk — see §3), and date of birth **only if the customer opts into the birthday-promotion flow**.

**We do not store** card numbers or ID-card copies on either channel.

### 3. Credit/Trust Score and How It's Used

The system calculates a score per customer (from purchase history/frequency) to decide whether Cash on Delivery (COD) is offered — **a low score auto-rejects COD**.

Because this directly affects the customer, it must be **disclosed in the customer-facing Privacy Notice**, not just kept in this internal document.

### 4. Access Levels

| Level | Who | Can access |
|---|---|---|
| **Super Admin** | Shop owners (one shared account, 2 people) | Full access to all customer data across both channels, for customer-service purposes (error correction, changes on request, record checks on request); the only level that sees the raw trust score |
| **Admin** | All other staff, including delivery | Shipping label and ordered-product info only, plus the COD accept/reject outcome (not the underlying score); delivery staff only see customer info while handling that shipment |
| **Mechanic** | Repair technicians | No access to any customer personal data |

### 5. Third-Party Disclosure

| Recipient | Data shared | Status |
|---|---|---|
| Kerry / Flash Express / Thailand Post | Name, address, phone (on the shipping label) | Active |
| SMS OTP provider | Phone number (sign-up/login verification) | Active — provider not yet named |
| SlipOK (payment slip verification) | Slip QR data + amount only (no customer data) | **Not active** — code exists, no SlipOK account created yet |
| Kira.office (POS) | — | Not a third party — fully in-house |

### 6. Retention and Deletion

We keep customer data indefinitely and delete it only on customer request. Some records (e.g., invoices/tax documents) may need to be kept for the statutory accounting retention period regardless of a deletion request — confirm the exact period with your accountant.

### 7. Data Breach Response

1. Whoever discovers a suspected breach (lost device, unauthorized access, leaked data) tells the Super Admin immediately.
2. Super Admin contains it fast — revoke access, change the shared account password, recover/wipe a lost device.
3. Assess what data leaked, how many customers, and whether there's real risk to them.
4. If there's real risk — notify the PDPC within 72 hours (or up to 15 days with a written explanation), and notify affected customers directly if the risk is high.
5. Write down what happened and what was done, even briefly — this is your evidence of compliance.

### 8. Staff Rules

- Don't use customer data for anything outside its stated purpose.
- Don't copy or photograph customer data onto personal devices.
- If you suspect a breach, tell the Super Admin immediately — don't try to assess it yourself first.

### 9. Reviewing This Policy

Review this document whenever systems, third-party providers, or customer-data workflows change.

---

## Notes for review (not part of the internal document)

- **Shared Super Admin login (2 people, 1 account):** this is your actual practice, so I documented it as-is, but flagging directly: a shared login means you can't tell *which* of the two of you did a given action if something goes wrong or needs investigating. Worth considering separate logins if Kira.office supports it — not insisting you change it, just noting the tradeoff.
- **The credit/trust score auto-rejecting COD is a real decision made about a specific customer with a real consequence.** It's now disclosed in the customer-facing Privacy Notice (§3), as flagged here.
- **§4 access tiers don't match what's actually enforced in the code today.** Earlier this session I found the codebase has an RBAC system defined (`owner`/`manager`/`stock_operator`/`finance_viewer`) but it isn't wired into any API route yet — meaning right now, technically, anyone with a valid login could reach anything, regardless of what this policy says. This document describes the *intended* access model; making the system actually enforce it is a separate engineering task, not something this policy alone accomplishes.
- OTP provider left unnamed per your call — once you pick a specific Thai SMS gateway, update §5 to name it.
