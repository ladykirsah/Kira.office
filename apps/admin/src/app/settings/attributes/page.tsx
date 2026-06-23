"use client";

import { AttributeManager, type AttrKindConfig } from "../AttributeManager";

const KINDS: AttrKindConfig[] = [
  { kind: "brand", label: "Part brands", listKey: "brands", placeholder: "Add brand…" },
  { kind: "usage", label: "Car systems", listKey: "usages", placeholder: "Add system…" },
  { kind: "type", label: "Part names", listKey: "types", placeholder: "Add part…" },
];

export default function PartAttributesPage() {
  return (
    <AttributeManager
      title="Part attributes"
      subtitle="Manage the lists behind a product's part dropdowns (brand · car system · part name). You can also type a new value directly on a product — it shows up here."
      kinds={KINDS}
    />
  );
}
