# Shopee Seller Centre — product editor (learning notes)

Reference for redesigning the Kira.office product editor to match the Shopee
`รายละเอียดสินค้า` (product details) page. Captured from the owner's screenshots.

## Shape

- A **tabbed editor** (not one long form) with a **sticky bottom action bar**:
  `ยกเลิก` (Cancel) · `ไม่แสดง` (Unpublish) · `อัปเดต` (Update, orange primary).
- A left **listing-quality panel**: `ปรับปรุงประสิทธิภาพสินค้า` — a progress meter
  (`ผ่านเกณฑ์` passed → `ยอดเยี่ยม` excellent), Shopee-AI suggestions, and a `สิ่งที่ต้องทำ`
  (to-do) checklist that drives visibility. A `แสดงผลลัพธ์` (preview) link sits top-right.

## Tabs

### 1. ข้อมูลทั่วไป — General
- **ภาพสินค้า (images)**: `* รูปภาพขนาด 1:1`. Up to **9** images (`เพิ่มรูปภาพ 7/9`); the
  first is the **cover** (`ปก`). Optional `รูปภาพขนาด 3:4` set for fashion.
- **วิดีโอสินค้า (video)**: ≤30 MB, 10–60 s, MP4, ≥1×1 px.
- **`* ชื่อสินค้า` (name)**: long, with a char counter (e.g. `85/120`).
- **`* หมวดหมู่` (category)**: a taxonomy breadcrumb (Auto parts > … > Air Conditioning)
  with an edit pencil.

### 2. คุณลักษณะของสินค้า — Attributes
- Completion counter: `ดำเนินการเสร็จสิ้น : 3 / 32` — more attributes = more visibility.
- Two-column dropdown grid, e.g. `* แบรนด์` (Brand, required), เอกสารแบรนด์, ประเทศต้นกำเนิด,
  น้ำหนัก, ระยะเวลาการรับประกัน, วัสดุ (`0/5`), ปริมาณ, ประเภทการประกัน, `สภาพ` (Condition: ใหม่),
  ประเภทรถยนต์ … + `ดูคุณลักษณะที่เลือกได้ทั้งหมด` (show all).

### 3. รายละเอียด — Description
- `* รายละเอียดสินค้า`: rich text + inline images (`เพิ่มรูปภาพ 0/12`), counter `738/5000`.
  Free-form with emojis, model compatibility, part codes, warranty terms.

### 4. ข้อมูลการขาย — Sales (the important one)
- **`ตัวเลือกสินค้า` (variations)**: a product has **variations**. Variation 1 is named
  (here `แบรนด์`) and has **options** (`Cool Gear 1710`, `Cool Gear 6070`, …), each with an
  optional description, drag-reorder, delete. A second variation axis can be added
  (`+ เพิ่มตัวเลือกสินค้า 2`) → a price/stock matrix.
- **`รายการตัวเลือกสินค้า` (variant table)**: a bulk-fill row (price / stock / SKU →
  `อัพเดตกับสินค้าทั้งหมด` apply-to-all), then a per-variant table:
  `variant (thumb) | * ราคา (price) | * คลัง (stock) | เลข SKU | GTIN`
  e.g. `Cool Gear 1710 | ฿1380 | 3 | … | …`.

### 5. การจัดส่ง — Shipping
- `ตั้งน้ำหนัก/ขนาดแยกแต่ละตัวเลือก` (per-variant weight/size) toggle.
- `* น้ำหนัก` (weight, kg), `ขนาดพัสดุ` (parcel L×W×H cm).
- `ค่าจัดส่ง` (shipping options): per-channel toggles + editable fee (Standard ฿35 on,
  Bulky ฿100 off, SPX self-collection off).

### 6. อื่น ๆ — Others (not yet captured)

## Gap analysis vs Kira.office today

| Shopee editor | Kira.office now | Gap |
|---|---|---|
| Multiple images + cover (≤9) | single `image_key` | **need** `product_images` (ordered, cover flag) |
| Product video | — | future / low priority |
| Long name + counter | `name` | minor (add counter/limit) |
| Category taxonomy | unused `type/brand/usage` ids | need a category model + picker |
| Rich attributes (brand, condition, warranty, vehicle type…) | none structured | need `product_attributes` |
| Rich description + images | plain `description` | optional upgrade |
| **Variations (multi-variant)** | **one default variant per product** | **biggest gap** |
| Per-variant price / stock / SKU | per-variant `pricing_profiles` + ledger exist, UI assumes one | extend UI/API to N variants |
| Shipping (weight/dims/fees) | — | Shopee-side; low priority for a local back-office |
| Listing-quality meter | — | optional nice-to-have |

## Build plan (when greenlit) — reuse the view→edit pattern, per tab

1. **Editor shell**: tabbed page (General / Variations / Details / Shipping / Other) with a
   sticky Save/Cancel bar; opens in view mode, Edit flips to editing (already our pattern).
2. **Images**: `product_images` table (productId, key, sortOrder, isCover) + gallery + cover.
3. **Variations** (highest value): variation builder + per-variant price/stock/SKU table with
   bulk apply-to-all. The `product_variants` table already exists — extend the API/UI from
   "one default variant" to N.
4. **Attributes + category**: structured attribute fields + a category picker.
5. **Description/shipping/video**: lower priority for a local-first seller (shipping is
   Shopee-managed); add when the live Shopee API phase needs them.

> Note for our context: on-site (offline) selling doesn't use shipping/category/attributes —
> those exist for the **Shopee listing**. So variations + images + price/stock are the
> high-value parts to mirror first; shipping/category/attributes matter once we sync to Shopee.
