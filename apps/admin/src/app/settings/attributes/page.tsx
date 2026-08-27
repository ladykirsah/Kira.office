"use client";

import { useT } from "../../LangProvider";
import { AttributeManager, type AttrKindConfig } from "../AttributeManager";

// `kind` values are the API contract (/attributes/:kind) and must not be renamed — only the
// user-facing labels changed. In this business a part's name IS its storefront category, so the
// `type` kind is presented as "Product categories", never "part name".
//
// The labels are phrases the selector translates as it draws them — this list is module-level,
// where no hook can run. (A `placeholder` field lived here too and was read by nothing; it went
// with the translation rather than being translated into text no one would ever see.)
const KINDS: AttrKindConfig[] = [
  { kind: "brand", label: { th: "ยี่ห้ออะไหล่", en: "Part brands" }, listKey: "brands" },
  { kind: "usage", label: { th: "ระบบในรถ", en: "Car systems" }, listKey: "usages" },
  {
    kind: "type",
    label: { th: "หมวดหมู่สินค้า", en: "Product categories" },
    listKey: "types",
    cover: "type",
    warranty: true,
  },
];

export default function PartAttributesPage() {
  const t = useT();
  return (
    <AttributeManager
      title={t({ th: "ตั้งค่าอะไหล่", en: "Part setup" })}
      subtitle={t({
        th: "จัดการรายการที่อยู่เบื้องหลังตัวเลือกของสินค้า (ยี่ห้อ · ระบบในรถ · หมวดหมู่สินค้า) หมวดหมู่สินค้ายังเก็บรูปหน้าร้านและระยะเวลารับประกันด้วย และพิมพ์ค่าใหม่ตรงหน้าสินค้าได้เลย — มันจะมาโผล่ที่นี่",
        en: "Manage the lists behind a product's dropdowns (brand · car system · product category). Product categories also carry the storefront tile photo and the warranty window. You can also type a new value directly on a product — it shows up here.",
      })}
      kinds={KINDS}
    />
  );
}
