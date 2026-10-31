import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { API_BASE } from "@/lib/config";
import { withUsage } from "@/lib/productEdit";
import { attrLabel, nameTaken, pickList } from "@/lib/productPickers";
import { createAttribute, type Attribute } from "@/lib/productsApi";
import { useLang } from "../AppProviders";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { AddRow, InputRow, PickRow, SearchBox } from "./parts";
import type { ProductEdit } from "./useProductEdit";

type Kind = "brand" | "usage" | "type";

const WORDS: Record<
  Kind,
  {
    title: Phrase;
    search: Phrase;
    add: Phrase;
    newTitle: Phrase;
    back: Phrase;
    list: "brands" | "usages" | "types";
  }
> = {
  brand: {
    title: { th: "ยี่ห้ออะไหล่", en: "Part brand" },
    search: { th: "ค้นยี่ห้อ", en: "Find a brand" },
    add: { th: "เพิ่มยี่ห้อใหม่", en: "Add a new brand" },
    newTitle: { th: "ยี่ห้อใหม่", en: "New brand" },
    back: { th: "‹ ยี่ห้อ", en: "‹ Brands" },
    list: "brands",
  },
  usage: {
    title: { th: "ระบบรถ", en: "Car system" },
    search: { th: "ค้นระบบรถ", en: "Find a system" },
    add: { th: "เพิ่มระบบใหม่", en: "Add a new system" },
    newTitle: { th: "ระบบใหม่", en: "New system" },
    back: { th: "‹ ระบบ", en: "‹ Systems" },
    list: "usages",
  },
  type: {
    title: { th: "ชื่ออะไหล่", en: "Part name" },
    search: { th: "ค้นชื่ออะไหล่", en: "Find a part name" },
    add: { th: "เพิ่มชื่ออะไหล่ใหม่", en: "Add a new part name" },
    newTitle: { th: "ชื่อใหม่", en: "New name" },
    back: { th: "‹ ชื่ออะไหล่", en: "‹ Part names" },
    list: "types",
  },
};

/**
 * ยี่ห้ออะไหล่ / ระบบรถ / ชื่ออะไหล่ (canvas v194): search, pick one with ✓, or ＋ add a new one with its
 * English and Thai names. Part names are only the chosen system's; changing the system clears a
 * part name that does not belong to it.
 */
export function PartSheet({ edit, kind }: { edit: ProductEdit; kind: Kind }) {
  const { t } = useLang();
  const w = WORDS[kind];
  const f = edit.form!;
  const all = edit.attrs?.[w.list] ?? [];
  const usage = edit.attrs?.usages.find((u) => u.name === f.usage) ?? null;
  const options =
    kind === "type" ? all.filter((a) => usage == null || a.usageId === usage.id) : all;
  const current = kind === "brand" ? f.brand : kind === "usage" ? f.usage : f.type;
  const [pick, setPick] = useState<string | null>(current);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const close = () => edit.setSheet(null);

  const apply = (name: string | null) => {
    if (kind === "brand") edit.set({ brand: name });
    else if (kind === "type") edit.set({ type: name });
    else if (name) {
      const typeUsage = edit.attrs?.types.find((x) => x.name === f.type)?.usageId ?? null;
      const usageName = edit.attrs?.usages.find((u) => u.id === typeUsage)?.name ?? null;
      const next = withUsage(f, name, usageName);
      edit.set({ usage: next.usage, type: next.type });
    } else edit.set({ usage: null, type: null });
    close();
  };

  if (adding) {
    return (
      <NewName
        edit={edit}
        kind={kind}
        usage={usage}
        onBack={() => setAdding(false)}
        onMade={(a) => apply(a.name)}
      />
    );
  }
  const shown = pickList(options, q);
  return (
    <Sheet title={t(w.title)} onClose={close} onDone={() => apply(pick)} tall>
      <SearchBox value={q} onChange={setQ} placeholder={t(w.search)} />
      <Group>
        {shown.map((a) => (
          <PickRow
            key={a.id}
            label={t(attrLabel(a))}
            checked={pick === a.name}
            onPress={() => setPick(pick === a.name ? null : a.name)}
          />
        ))}
        <AddRow label={t(w.add)} onPress={() => setAdding(true)} />
      </Group>
    </Sheet>
  );
}

/** ＋ เพิ่ม…ใหม่: English and Thai names (a part name also shows the system it goes into). */
function NewName(props: {
  edit: ProductEdit;
  kind: Kind;
  usage: Attribute | null;
  onBack: () => void;
  onMade: (a: Attribute) => void;
}) {
  const { t } = useLang();
  const w = WORDS[props.kind];
  const [nameEn, setNameEn] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [problem, setProblem] = useState<Phrase | null>(null);
  const [busy, setBusy] = useState(false);
  const list = props.edit.attrs?.[w.list] ?? [];

  const done = async () => {
    if (busy) return;
    if (!nameEn.trim()) return setProblem({ th: "ใส่ชื่ออังกฤษก่อน", en: "Add the English name" });
    if (props.kind === "type" && !props.usage) {
      return setProblem({ th: "เลือกระบบรถก่อน", en: "Choose the car system first" });
    }
    const taken = nameTaken(list, nameEn, nameTh);
    if (taken) {
      const shown = attrLabel(taken);
      return setProblem({
        th: `มี “${shown.th}” แล้ว · เลือกจากรายการ`,
        en: `“${shown.en}” is already there · pick it from the list`,
      });
    }
    setBusy(true);
    try {
      const made = await createAttribute(fetch, API_BASE, props.edit.token, props.kind, {
        nameEn,
        nameTh,
        usageId: props.kind === "type" ? props.usage!.id : undefined,
      });
      const row: Attribute = { ...made, nameEn: nameEn.trim(), nameTh: nameTh.trim() || null };
      const attrs = props.edit.attrs!;
      props.edit.setAttrs({ ...attrs, [w.list]: [...attrs[w.list], row] });
      props.onMade(row);
    } catch (e) {
      setProblem({
        th: e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ",
        en: e instanceof Error ? e.message : "Not added",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t(w.newTitle)}
      left={{ label: t(w.back), onPress: props.onBack }}
      onClose={() => props.edit.setSheet(null)}
      onDone={() => void done()}
      tall
    >
      <Group>
        {props.kind === "type" && (
          <InputRow
            label={t({ th: "อยู่ในระบบ", en: "In system" })}
            value={props.usage ? t(attrLabel(props.usage)) : "—"}
            editable={false}
            onChange={() => undefined}
          />
        )}
        <InputRow
          label={t({ th: "ชื่ออังกฤษ", en: "English name" })}
          value={nameEn}
          onChange={(v) => {
            setNameEn(v);
            setProblem(null);
          }}
        />
        <InputRow
          label={t({ th: "ชื่อไทย", en: "Thai name" })}
          value={nameTh}
          onChange={(v) => {
            setNameTh(v);
            setProblem(null);
          }}
          last
        />
      </Group>
      {problem && <FieldError text={t(problem)} />}
    </Sheet>
  );
}
