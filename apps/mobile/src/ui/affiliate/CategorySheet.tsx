import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { createCategory } from "@/lib/affiliateApi";
import type { AffiliateCategory } from "@/lib/affiliatePage";
import { API_BASE } from "@/lib/config";
import { useLang } from "../AppProviders";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { AddRow, InputRow, PickRow, SearchBox } from "../products/parts";

/**
 * หมวดหมู่ (canvas v238): search, ไม่มีหมวด, the categories, ✓ on the picked one, and ＋ เพิ่มหมวดใหม่ to
 * name a new one right there. ✓ in หมวดใหม่ creates it and picks it at once.
 */
export function CategorySheet(props: {
  categories: AffiliateCategory[];
  current: string | null;
  token: string;
  onPick: (category: AffiliateCategory | null) => void;
  onMade: (category: AffiliateCategory) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [pick, setPick] = useState<string | null>(props.current);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <NewCategory
        token={props.token}
        onBack={() => setAdding(false)}
        onClose={props.onClose}
        onMade={(category) => {
          props.onMade(category);
          props.onPick(category);
        }}
      />
    );
  }
  const typed = q.trim().toLowerCase();
  // Thai order (เกจวัด before น้ำยาแอร์), as the list's groups are; the server sorts by raw code.
  const shown = props.categories
    .filter((c) => c.name.toLowerCase().includes(typed))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
  return (
    <Sheet
      title={t({ th: "หมวดหมู่", en: "Category" })}
      onClose={props.onClose}
      onDone={() => props.onPick(props.categories.find((c) => c.id === pick) ?? null)}
      tall
    >
      <SearchBox
        value={q}
        onChange={setQ}
        placeholder={t({ th: "ค้นหมวด", en: "Find a category" })}
      />
      <Group>
        {!typed && (
          <PickRow
            label={t({ th: "ไม่มีหมวด", en: "No category" })}
            checked={pick == null}
            onPress={() => setPick(null)}
          />
        )}
        {shown.map((c) => (
          <PickRow
            key={c.id}
            label={c.name}
            checked={pick === c.id}
            onPress={() => setPick(pick === c.id ? null : c.id)}
          />
        ))}
        <AddRow
          label={t({ th: "เพิ่มหมวดใหม่", en: "Add a new category" })}
          onPress={() => setAdding(true)}
        />
      </Group>
    </Sheet>
  );
}

function NewCategory(props: {
  token: string;
  onBack: () => void;
  onClose: () => void;
  onMade: (category: AffiliateCategory) => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<Phrase | null>(null);
  const [busy, setBusy] = useState(false);

  const done = async () => {
    if (busy) return;
    if (!name.trim()) return setProblem({ th: "ใส่ชื่อหมวดก่อน", en: "Add the category name" });
    setBusy(true);
    try {
      const made = await createCategory(fetch, API_BASE, props.token, name.trim());
      props.onMade({ ...made, sortOrder: 0 });
    } catch (e) {
      const why = e instanceof Error ? e.message : "";
      setProblem({ th: why || "เพิ่มไม่สำเร็จ", en: why || "Not added" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t({ th: "หมวดใหม่", en: "New category" })}
      left={{ label: t({ th: "‹ หมวดหมู่", en: "‹ Categories" }), onPress: props.onBack }}
      onClose={props.onClose}
      onDone={() => void done()}
      tall
    >
      <Group>
        <InputRow
          label={t({ th: "ชื่อหมวด", en: "Name" })}
          value={name}
          placeholder={t({ th: "เช่น ปั๊มสุญญากาศ", en: "e.g. Vacuum pumps" })}
          onChange={(v) => {
            setName(v);
            setProblem(null);
          }}
          last
        />
      </Group>
      {problem && <FieldError text={t(problem)} />}
    </Sheet>
  );
}
