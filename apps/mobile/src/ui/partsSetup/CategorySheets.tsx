import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  blockedDelete,
  categoryDraft,
  deleteTitle,
  descriptionLine,
  descriptionNote,
  descriptionPreview,
  findSystems,
  nameProblems,
  systemsWithCounts,
  titleOf,
  WARRANTY_CHOICES,
  warrantyWords,
  type CarSystem,
  type Category,
  type CategoryDraft,
  type NameDraft,
} from "@/lib/partsSetupPage";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { AddRow, InputRow, PickRow, SearchBox } from "../products/parts";
import { photoPreview, pickPhoto } from "../products/pickPhoto";
import { SPACE, TYPE } from "../theme";
import { WRONG_PICTURE } from "./NameSheets";
import {
  BlockedSheet,
  DeleteRow,
  DeleteSheet,
  DescriptionCard,
  PictureCard,
  StepRow,
  ValueRow,
} from "./parts";
import type { PartsSetupState, PictureChange } from "./usePartsSetup";

const products = (n: number) =>
  n > 0 ? { th: `${n} สินค้า`, en: `${n} products` } : { th: "ยังไม่มีสินค้า", en: "None yet" };

function systemName(systems: CarSystem[], id: string | null): string | null {
  const s = systems.find((x) => x.id === id);
  return s ? titleOf(s) : null;
}

/** The full text, as the website shows it (pre-line), with where it shows under it. */
function FullText({ text, note }: { text: string; note: string }) {
  const { theme } = useTheme();
  return (
    <>
      <View style={[styles.textCard, { backgroundColor: theme.surface }]}>
        <Text style={[TYPE.subhead, styles.lines, { color: theme.text }]}>{text}</Text>
      </View>
      <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>{note}</Text>
    </>
  );
}

/**
 * A tapped category: its AirPlus picture, names, system, warranty, คำอธิบายบน AirPlus (the first
 * lines; tap to read it all) and how many products use it. แก้ไข opens the form.
 */
function CategoryDetailsSheet(props: {
  cat: Category;
  systems: CarSystem[];
  onEdit: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const c = props.cat;
  const [reading, setReading] = useState(false);
  const text = c.description?.trim() ?? "";
  if (reading) {
    return (
      <Sheet
        title={t({ th: "คำอธิบายบน AirPlus", en: "AirPlus description" })}
        left={{ label: `‹ ${titleOf(c)}`, onPress: () => setReading(false) }}
        onClose={props.onClose}
      >
        <FullText text={text} note={t(descriptionNote(c))} />
      </Sheet>
    );
  }
  return (
    <Sheet
      title={titleOf(c)}
      onClose={props.onClose}
      right={{ label: t({ th: "แก้ไข", en: "Edit" }), onPress: props.onEdit }}
    >
      <PictureCard
        name={t({ th: "รูปบนเว็บ AirPlus", en: "Photo on AirPlus" })}
        imageKey={c.imageKey}
        note={
          c.imageKey
            ? t({ th: "ขึ้นในหน้าหมวดหมู่บนเว็บ", en: "Shown on the website's categories" })
            : t({ th: "ยังไม่มีรูป · บนเว็บขึ้น ✦ แทน", en: "No photo yet · the website shows ✦" })
        }
      />
      <Group>
        <ValueRow label={t({ th: "ชื่อไทย", en: "Thai name" })} value={c.nameTh ?? "—"} />
        <ValueRow label={t({ th: "ชื่ออังกฤษ", en: "English name" })} value={c.nameEn} last />
      </Group>
      <Group>
        <ValueRow
          label={t({ th: "อยู่ในระบบ", en: "System" })}
          value={
            systemName(props.systems, c.systemId) ?? t({ th: "ยังไม่ได้จัดระบบ", en: "No system" })
          }
        />
        <ValueRow
          label={t({ th: "รับประกัน", en: "Warranty" })}
          value={t(warrantyWords(c.warrantyDays))}
          last
        />
      </Group>
      {text ? (
        <DescriptionCard
          label={t({ th: "คำอธิบายบน AirPlus", en: "AirPlus description" })}
          preview={descriptionPreview(text)}
          onPress={() => setReading(true)}
        />
      ) : (
        <Group>
          <ValueRow
            label={t({ th: "คำอธิบายบน AirPlus", en: "AirPlus description" })}
            value={t({ th: "ยังไม่มี", en: "None yet" })}
            last
          />
        </Group>
      )}
      <Group>
        <ValueRow
          label={t({ th: "ใช้ใน", en: "Used in" })}
          value={t(products(c.productCount))}
          last
        />
      </Group>
    </Sheet>
  );
}

type Step = "main" | "system" | "newSystem" | "warranty" | "text";

/**
 * เพิ่มหมวดหมู่ / a category's แก้ไข. Its rows open steps inside the same sheet ("‹ หมวดหมู่", red ✓):
 * อยู่ในระบบ (search, pick, ＋ เพิ่มระบบใหม่ — saved then picked), รับประกัน (choices or own days) and
 * คำอธิบายบน AirPlus (type, blank lines and emoji kept). บันทึก saves it all; a picture waits for it.
 */
function CategoryFormSheet(props: {
  start: Category | null;
  systemId: string | null;
  state: PartsSetupState;
  systems: CarSystem[];
  cats: Category[];
  onDelete: (c: Category) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [d, setD] = useState<CategoryDraft>(
    categoryDraft(props.start ?? undefined, props.systemId),
  );
  const [step, setStep] = useState<Step>("main");
  const [change, setChange] = useState<PictureChange>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState(false);
  const [q, setQ] = useState("");
  const [ownDays, setOwnDays] = useState<string | null>(null);
  const [text, setText] = useState(d.description);
  const [newSystem, setNewSystem] = useState<NameDraft>({ id: null, nameTh: "", nameEn: "" });
  const [systemTried, setSystemTried] = useState(false);
  const busy = useRef(false);
  const set = (patch: Partial<CategoryDraft>) => setD((now) => ({ ...now, ...patch }));
  const problems = tried ? nameProblems("category", d, props.cats) : {};
  const back = () => {
    setQ("");
    setStep("main");
  };
  // The typing step's note names this category as it now reads ("ตู้แอร์ทุกชิ้น (40)").
  const forNote: Category = {
    ...d,
    id: d.id ?? "",
    nameTh: d.nameTh.trim() || null,
    imageKey: null,
    description: text,
    productCount: props.start?.productCount ?? 0,
  };

  const choose = async (source: "camera" | "library") => {
    const photo = await pickPhoto(source);
    if (!photo) return;
    setChange({ photo });
    setPreview(photoPreview(photo));
  };

  const save = async () => {
    setTried(true);
    if (busy.current || Object.keys(nameProblems("category", d, props.cats)).length > 0) return;
    busy.current = true;
    setRefused(false);
    const out = await props.state.saveCategory(props.start, d, change);
    busy.current = false;
    if (out === "failed") return setRefused(true);
    if (out === "wrong-picture") props.state.showToast(WRONG_PICTURE);
    props.onClose();
  };

  if (step === "system") {
    const rows = findSystems(systemsWithCounts(props.systems, props.cats), q);
    return (
      <Sheet
        title={t({ th: "อยู่ในระบบ", en: "System" })}
        left={{ label: t({ th: "‹ หมวดหมู่", en: "‹ Category" }), onPress: back }}
        onDone={back}
        onClose={props.onClose}
        tall
      >
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={t({ th: "ค้นระบบ", en: "Find a system" })}
        />
        <Group>
          {rows.map((s) => (
            <PickRow
              key={s.id}
              label={titleOf(s)}
              checked={d.systemId === s.id}
              onPress={() => set({ systemId: s.id })}
            />
          ))}
          <AddRow
            label={t({ th: "เพิ่มระบบใหม่", en: "New system" })}
            onPress={() => setStep("newSystem")}
          />
        </Group>
      </Sheet>
    );
  }

  if (step === "newSystem") {
    const sysProblems = systemTried ? nameProblems("system", newSystem, props.systems) : {};
    const addIt = async () => {
      setSystemTried(true);
      if (busy.current || Object.keys(nameProblems("system", newSystem, props.systems)).length > 0)
        return;
      busy.current = true;
      const id = await props.state.addSystem(newSystem);
      busy.current = false;
      if (!id) return setRefused(true);
      setRefused(false);
      set({ systemId: id });
      back();
    };
    return (
      <Sheet
        title={t({ th: "เพิ่มระบบ", en: "Add a system" })}
        left={{
          label: t({ th: "‹ อยู่ในระบบ", en: "‹ System" }),
          onPress: () => setStep("system"),
        }}
        onClose={props.onClose}
      >
        <Group>
          <InputRow
            label={t({ th: "ชื่อไทย", en: "Thai name" })}
            value={newSystem.nameTh}
            placeholder={t({ th: "เช่น ระบบหล่อเย็น", en: "e.g. ระบบหล่อเย็น" })}
            onChange={(nameTh) => setNewSystem((n) => ({ ...n, nameTh }))}
          />
          <InputRow
            label={t({ th: "ชื่ออังกฤษ", en: "English name" })}
            value={newSystem.nameEn}
            placeholder={t({ th: "เช่น Cooling", en: "e.g. Cooling" })}
            onChange={(nameEn) => setNewSystem((n) => ({ ...n, nameEn }))}
            last
          />
        </Group>
        {sysProblems.nameEn && <FieldError text={t(sysProblems.nameEn)} />}
        <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void addIt()} />
        {refused && (
          <FieldError text={t({ th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Not saved, try again" })} />
        )}
      </Sheet>
    );
  }

  if (step === "warranty") {
    const words = q.trim();
    const choices = WARRANTY_CHOICES.filter(
      (days) => !words || t(warrantyWords(days)).includes(words),
    );
    const done = () => {
      const typed = ownDays === null ? NaN : Number(ownDays);
      if (Number.isInteger(typed) && typed >= 0) set({ warrantyDays: typed });
      setOwnDays(null);
      back();
    };
    return (
      <Sheet
        title={t({ th: "รับประกัน", en: "Warranty" })}
        left={{ label: t({ th: "‹ หมวดหมู่", en: "‹ Category" }), onPress: done }}
        onDone={done}
        onClose={props.onClose}
        tall
      >
        <SearchBox value={q} onChange={setQ} placeholder={t({ th: "ค้น", en: "Find" })} />
        <Group>
          {choices.map((days) => (
            <PickRow
              key={days}
              label={t(warrantyWords(days))}
              checked={ownDays === null && d.warrantyDays === days}
              onPress={() => {
                setOwnDays(null);
                set({ warrantyDays: days });
              }}
            />
          ))}
          {ownDays === null ? (
            <AddRow
              label={t({ th: "ตั้งจำนวนวันเอง", en: "Set days" })}
              onPress={() =>
                setOwnDays(WARRANTY_CHOICES.includes(d.warrantyDays) ? "" : String(d.warrantyDays))
              }
            />
          ) : (
            <InputRow
              label={t({ th: "จำนวนวัน", en: "Days" })}
              value={ownDays}
              placeholder={t({ th: "เช่น 45", en: "e.g. 45" })}
              unit={t({ th: "วัน", en: "days" })}
              keyboardType="number-pad"
              onChange={(v) => setOwnDays(v.replace(/[^0-9]/g, ""))}
              last
            />
          )}
        </Group>
      </Sheet>
    );
  }

  if (step === "text") {
    const done = () => {
      set({ description: text });
      back();
    };
    return (
      <Sheet
        title={t({ th: "คำอธิบายบน AirPlus", en: "AirPlus description" })}
        left={{ label: t({ th: "‹ หมวดหมู่", en: "‹ Category" }), onPress: done }}
        onDone={done}
        onClose={props.onClose}
        tall
      >
        <View
          style={[
            styles.textCard,
            styles.typing,
            { backgroundColor: theme.surface, borderColor: theme.text },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            placeholder={t({
              th: "พิมพ์คำอธิบาย เว้นบรรทัด ใส่อีโมจิได้",
              en: "Type the description",
            })}
            placeholderTextColor={theme.textFaint}
            accessibilityLabel={t({ th: "คำอธิบายบน AirPlus", en: "AirPlus description" })}
            style={[TYPE.subhead, styles.lines, styles.input, { color: theme.text }]}
          />
        </View>
        <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>
          {t(descriptionNote(forNote))}
        </Text>
      </Sheet>
    );
  }

  const hasPicture = change === "remove" ? false : !!(preview || props.start?.imageKey);
  return (
    <Sheet
      title={props.start ? titleOf(props.start) : t({ th: "เพิ่มหมวดหมู่", en: "Add a category" })}
      onClose={props.onClose}
    >
      <PictureCard
        name={t({ th: "รูปบนเว็บ AirPlus", en: "Photo on AirPlus" })}
        imageKey={change === "remove" ? null : (props.start?.imageKey ?? null)}
        preview={preview}
        onChoose={(source) => void choose(source)}
        onRemove={
          hasPicture
            ? () => {
                setChange("remove");
                setPreview(null);
              }
            : undefined
        }
      />
      <Group>
        <InputRow
          label={t({ th: "ชื่อไทย", en: "Thai name" })}
          value={d.nameTh}
          placeholder={t({ th: "เช่น สวิตช์แรงดัน", en: "e.g. สวิตช์แรงดัน" })}
          onChange={(nameTh) => set({ nameTh })}
        />
        <InputRow
          label={t({ th: "ชื่ออังกฤษ", en: "English name" })}
          value={d.nameEn}
          placeholder={t({ th: "เช่น Pressure switch", en: "e.g. Pressure switch" })}
          onChange={(nameEn) => set({ nameEn })}
          last
        />
      </Group>
      {problems.nameEn && <FieldError text={t(problems.nameEn)} />}
      <Group>
        <ValueRow
          label={t({ th: "อยู่ในระบบ", en: "System" })}
          value={systemName(props.systems, d.systemId) ?? t({ th: "เลือกระบบ", en: "Pick" })}
          onPress={() => setStep("system")}
        />
        <ValueRow
          label={t({ th: "รับประกัน", en: "Warranty" })}
          value={t(warrantyWords(d.warrantyDays))}
          onPress={() => setStep("warranty")}
          last
        />
      </Group>
      {problems.system && <FieldError text={t(problems.system)} />}
      <Group>
        <StepRow
          label={t({ th: "คำอธิบายบน AirPlus", en: "AirPlus description" })}
          second={
            d.description.trim()
              ? descriptionLine(d.description)
              : t({ th: "ไม่ใส่ก็ได้", en: "Optional" })
          }
          hint={!d.description.trim()}
          oneLine
          onPress={() => {
            setText(d.description);
            setStep("text");
          }}
        />
      </Group>
      {props.start && (
        <DeleteRow
          label={t({ th: "ลบหมวดหมู่", en: "Delete category" })}
          onPress={() => props.onDelete(props.start!)}
        />
      )}
      <View style={styles.button}>
        <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void save()} />
      </View>
      {refused && (
        <FieldError text={t({ th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Not saved, try again" })} />
      )}
    </Sheet>
  );
}

/** What a page shows of a category: its details, then its form, then ask before deleting. */
export type CategoryOpen =
  | { mode: "view"; cat: Category }
  | { mode: "form"; cat: Category | null; systemId: string | null }
  | { mode: "delete"; cat: Category }
  | null;

export function CategoryFlow(props: {
  open: CategoryOpen;
  setOpen: (o: CategoryOpen) => void;
  state: PartsSetupState;
}) {
  const { t } = useLang();
  const data = props.state.data;
  const o = props.open;
  if (!o || !data) return null;
  const close = () => props.setOpen(null);
  if (o.mode === "view") {
    return (
      <CategoryDetailsSheet
        cat={o.cat}
        systems={data.systems}
        onEdit={() => props.setOpen({ mode: "form", cat: o.cat, systemId: o.cat.systemId })}
        onClose={close}
      />
    );
  }
  if (o.mode === "form") {
    return (
      <CategoryFormSheet
        start={o.cat}
        systemId={o.systemId}
        state={props.state}
        systems={data.systems}
        cats={data.categories}
        onDelete={(cat) => props.setOpen({ mode: "delete", cat })}
        onClose={close}
      />
    );
  }
  const blocked = blockedDelete(o.cat);
  if (blocked)
    return <BlockedSheet title={t(blocked.title)} body={t(blocked.body)} onClose={close} />;
  return (
    <DeleteSheet
      title={t(deleteTitle("category", o.cat))}
      onDelete={() => {
        close();
        void props.state.remove("category", o.cat.id);
      }}
      onClose={close}
    />
  );
}

const styles = StyleSheet.create({
  textCard: { borderRadius: 20, paddingVertical: 14, paddingHorizontal: SPACE.l },
  typing: { borderWidth: 2, minHeight: 320 },
  lines: { lineHeight: 24 },
  input: { minHeight: 290, textAlignVertical: "top", outlineStyle: "none" } as object,
  note: { marginTop: -4, paddingHorizontal: SPACE.l },
  button: { marginTop: SPACE.xs },
});
