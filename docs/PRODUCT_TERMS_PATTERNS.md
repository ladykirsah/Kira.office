# Product Terms Patterns (Thai)

## Goal

Generate consistent **Thai-language** product terms and conditions from approved templates, with
admin review before publishing. Patterns store `language = th`.

## Pattern Design

Templates use placeholders filled from product and business fields:

`{{product_name}}` · `{{brand}}` · `{{product_type}}` · `{{usage_category}}` · `{{included_items}}` ·
`{{warranty_days}}` · `{{return_days}}` · `{{safety_warnings}}` · `{{care_instructions}}` ·
`{{expiry_date}}` · `{{country_of_origin}}` · `{{seller_name}}`

## Default Pattern (Thai)

```text
สินค้า: {{product_name}}
แบรนด์: {{brand}}
ประเภท: {{product_type}}
การใช้งาน: {{usage_category}}

เมื่อสั่งซื้อสินค้านี้ ผู้ซื้อยืนยันว่าได้ตรวจสอบรายละเอียดสินค้า รูปภาพ ข้อมูลจำเพาะ และวิธีใช้งานแล้ว

กรุณาตรวจสอบสินค้าเมื่อได้รับ การขอคืนหรือเปลี่ยนสินค้าต้องแจ้งภายใน {{return_days}} วัน
ทั้งนี้เป็นไปตามนโยบายของร้านและกฎของแพลตฟอร์ม

ระยะเวลารับประกัน: {{warranty_days}} วัน เว้นแต่ระบุไว้เป็นอย่างอื่น

วิธีดูแลและการใช้งาน:
{{care_instructions}}

คำเตือนด้านความปลอดภัย:
{{safety_warnings}}

รายการที่ได้รับ:
{{included_items}}
```

## Consumable / Expiry Pattern (Thai)

```text
สินค้า: {{product_name}}
แบรนด์: {{brand}}

ควรใช้สินค้าตามรายละเอียดและคำแนะนำบนฉลาก

วันหมดอายุหรือควรใช้ก่อน: {{expiry_date}}

วิธีจัดเก็บ:
{{care_instructions}}

คำเตือนด้านความปลอดภัย:
{{safety_warnings}}

การคืนสินค้าอาจถูกจำกัดหลังเปิดใช้งานหรือบรรจุภัณฑ์เสียหาย ทั้งนี้เป็นไปตามนโยบายร้านและกฎของแพลตฟอร์ม
```

## Electronics / Accessory Pattern (Thai)

```text
สินค้า: {{product_name}}
แบรนด์: {{brand}}

กรุณาตรวจสอบความเข้ากันได้ก่อนสั่งซื้อ หมายเหตุความเข้ากันได้:
{{usage_category}}

ระยะเวลารับประกัน: {{warranty_days}} วัน

การรับประกันไม่ครอบคลุมการใช้งานผิดวิธี ความเสียหายจากอุบัติเหตุ การซ่อมโดยไม่ได้รับอนุญาต
ความเสียหายจากน้ำ หรือการสึกหรอตามปกติ เว้นแต่กฎหมายหรือนโยบายแพลตฟอร์มกำหนด

รายการที่ได้รับ:
{{included_items}}
```

## Review Rules

- Generated terms start as `draft`.
- Admin reviews and approves before publishing.
- Every approved terms body is **versioned**.
- Changing a pattern does **not** auto-rewrite previously approved product terms.

## Legal Note

These templates are operational drafting aids, not legal advice. Final Thai terms should be checked
against Thai law, Shopee Thailand rules, and the shop's actual policy.
