"use client";

import { AttributeManager, type AttrKindConfig } from "../AttributeManager";

// `kind` values are the API contract (/attributes/:kind) and must not be renamed — only the
// user-facing labels changed. In this business a part's name IS its storefront category, so the
// `type` kind is presented as "Product categories", never "part name".
const KINDS: AttrKindConfig[] = [
  { kind: "brand", label: "Part brands", listKey: "brands", placeholder: "Add brand…" },
  { kind: "usage", label: "Car systems", listKey: "usages", placeholder: "Add system…" },
  {
    kind: "type",
    label: "Product categories",
    listKey: "types",
    placeholder: "Category title…",
    cover: "type",
    warranty: true,
  },
];

export default function PartAttributesPage() {
  return (
    <AttributeManager
      title="Part attributes"
      subtitle="Manage the lists behind a product's dropdowns (brand · car system · product category). Product categories also carry the storefront tile photo and the warranty window. You can also type a new value directly on a product — it shows up here."
      kinds={KINDS}
    />
  );
}
