import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  aboutExample,
  aboutLine,
  canDeleteCategory,
  categoryDraft,
  DESCRIPTION_NOTE,
  deleteTitle,
  FIELDS_HINT,
  findSystems,
  forAllNote,
  nameProblems,
  systemsWithCounts,
  TERMS_NOTE,
  termsProblem,
  textPreview,
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
import { Segmented } from "../Segmented";
import { SPACE, TYPE } from "../theme";
import { WRONG_PICTURE } from "./NameSheets";
import { AboutCard, DeleteRow, DeleteSheet, PictureCard, StepRow, ValueRow } from "./parts";
import type { PartsSetupState, PictureChange } from "./usePartsSetup";

const products = (n: number) =>
  n > 0 ? { th: `${n} สินค้า`, en: `${n} products` } : { th: "ยังไม่มีสินค้า", en: "None yet" };

function systemName(systems: CarSystem[], id: string | null): string | null {
  const s = systems.find((x) => x.id === id);
  return s ? titleOf(s) : null;
}

const ABOUT = { th: "เกี่ยวกับสินค้าประเภทนี้", en: "About this kind of product" };
const CATEGORY = { th: "หมวดหมู่", en: "Category" };
/** เกี่ยวกับสินค้าประเภทนี้ is too long for "‹ คอมเพรสเซอร์" beside it on a phone: a round ‹, as iOS does. */
const backTo = (name: string) => ({ th: `กลับไป ${name}`, en: `Back to ${name}` });
const DESCRIPTION = { th: "คำอธิบาย", en: "Description" };
const TERMS = { th: "เงื่อนไข", en: "Conditions" };
const NONE_YET = { th: "ยังไม่มี", en: "None yet" };

/** A small grey name over a card: คำอธิบาย, เงื่อนไข. */
function Label({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[TYPE.footnote, styles.label, { color: theme.textMuted }]}>{text}</Text>;
}

/** A small grey line under a card: where it shows, what may be typed. */
function Note({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>{text}</Text>;
}

/** The full text, as the website shows it (pre-line); grey ยังไม่มี when there is none. */
function FullText({ text, empty = false }: { text: string; empty?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.textCard, { backgroundColor: theme.surface }]}>
      <Text style={[TYPE.subhead, styles.lines, { color: empty ? theme.textMuted : theme.text }]}>
        {text}
      </Text>
    </View>
  );
}

/** A box to type a long text in: it grows with what is typed (no scrolling inside the sheet). */
function GrowingBox(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  typing: boolean;
  onFocus: () => void;
  autoFocus?: boolean;
}) {
  const { theme } = useTheme();
  const [height, setHeight] = useState(0);
  return (
    <View
      style={[
        styles.textCard,
        styles.typing,
        { backgroundColor: theme.surface, borderColor: props.typing ? theme.text : theme.surface },
      ]}
    >
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        onFocus={props.onFocus}
        onContentSizeChange={(e) => setHeight(e.nativeEvent.contentSize.height)}
        multiline
        autoFocus={props.autoFocus}
        placeholder={props.placeholder}
        placeholderTextColor={theme.textFaint}
        accessibilityLabel={props.label}
        style={[
          TYPE.subhead,
          styles.lines,
          styles.input,
          { color: theme.text, height: Math.max(height, BOX_MIN) },
        ]}
      />
    </View>
  );
}

/**
 * A tapped category: its AirPlus picture, names, system, warranty, เกี่ยวกับสินค้าประเภทนี้ (the first
 * lines of its คำอธิบาย and เงื่อนไข; tap to read both) and how many products use it. แก้ไข opens the form.
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
  const terms = c.terms?.trim() ?? "";
  if (reading) {
    return (
      <Sheet
        title={t(ABOUT)}
        left={{ label: "‹", a11y: t(backTo(titleOf(c))), onPress: () => setReading(false) }}
        onClose={props.onClose}
        tall
      >
        <Label text={t(DESCRIPTION)} />
        <FullText text={text || t(NONE_YET)} empty={!text} />
        <Note text={t(DESCRIPTION_NOTE)} />
        <Label text={t(TERMS)} />
        <FullText text={terms || t(NONE_YET)} empty={!terms} />
        <Note text={t(TERMS_NOTE)} />
        <Note text={t(forAllNote(c))} />
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
      {text || terms ? (
        <AboutCard
          label={t(ABOUT)}
          parts={[
            { label: t(DESCRIPTION), text: textPreview(text, 2) || t(NONE_YET), empty: !text },
            { label: t(TERMS), text: textPreview(terms, 2) || t(NONE_YET), empty: !terms },
          ]}
          onPress={() => setReading(true)}
        />
      ) : (
        <Group>
          <ValueRow label={t(ABOUT)} value={t(NONE_YET)} last />
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
 * เกี่ยวกับสินค้าประเภทนี้ (คำอธิบาย and เงื่อนไข, typed as wanted; ตัวอย่าง shows them on one of the
 * category's products; a fill-in no product has is said under its box). บันทึก saves it all.
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
  const [terms, setTerms] = useState(d.terms);
  const [tab, setTab] = useState<"edit" | "example">("edit");
  const [typing, setTyping] = useState<"description" | "terms">("description");
  const [termsTried, setTermsTried] = useState(false);
  const [newSystem, setNewSystem] = useState<NameDraft>({ id: null, nameTh: "", nameEn: "" });
  const [systemTried, setSystemTried] = useState(false);
  const busy = useRef(false);
  const set = (patch: Partial<CategoryDraft>) => setD((now) => ({ ...now, ...patch }));
  const problems = tried ? nameProblems("category", d, props.cats) : {};
  const back = () => {
    setQ("");
    setStep("main");
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
    const termsError = termsTried ? termsProblem(terms) : null;
    const done = () => {
      if (termsProblem(terms)) {
        setTermsTried(true);
        setTab("edit");
        return;
      }
      set({ description: text, terms });
      back();
    };
    const example = props.start
      ? aboutExample(props.start, { ...d, description: text, terms })
      : null;
    return (
      <Sheet
        title={t(ABOUT)}
        left={{
          label: "‹",
          a11y: t(backTo(d.nameTh.trim() || d.nameEn.trim() || t(CATEGORY))),
          onPress: done,
        }}
        onDone={done}
        onClose={props.onClose}
        tall
      >
        <Segmented
          label={t(ABOUT)}
          options={[
            { value: "edit", label: t({ th: "แก้ไข", en: "Edit" }) },
            { value: "example", label: t({ th: "ตัวอย่าง", en: "Example" }) },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "edit" ? (
          <>
            <Label text={t(DESCRIPTION)} />
            <GrowingBox
              label={t(DESCRIPTION)}
              value={text}
              onChange={setText}
              typing={typing === "description"}
              onFocus={() => setTyping("description")}
              autoFocus
              placeholder={t({
                th: "พิมพ์คำอธิบาย เว้นบรรทัด ใส่อีโมจิได้",
                en: "Type the description",
              })}
            />
            <Label text={t(TERMS)} />
            <GrowingBox
              label={t(TERMS)}
              value={terms}
              onChange={setTerms}
              typing={typing === "terms"}
              onFocus={() => setTyping("terms")}
              placeholder={t({
                th: "พิมพ์เงื่อนไข ใส่ชื่อ ยี่ห้อ รับประกัน ด้วยช่องข้างล่างได้",
                en: "Type the conditions; the fill-ins below are allowed",
              })}
            />
            {termsError && <FieldError text={t(termsError)} />}
            <Note text={t(FIELDS_HINT)} />
          </>
        ) : example ? (
          <>
            <Note text={t(example.from)} />
            <Label text={t(DESCRIPTION)} />
            <FullText
              text={example.description ?? t({ th: "ไม่มีคำอธิบาย", en: "No description" })}
              empty={!example.description}
            />
            <Label text={t(TERMS)} />
            <FullText
              text={
                example.terms ??
                t({ th: "บน AirPlus ไม่มีกล่อง เงื่อนไข", en: "No Conditions box on AirPlus" })
              }
              empty={!example.terms}
            />
            <Note text={t({ th: "เหมือนบน AirPlus ทุกตัวอักษร", en: "Exactly as on AirPlus" })} />
          </>
        ) : (
          <FullText
            text={t({
              th: "ยังไม่มีสินค้าในหมวดนี้ให้ดู",
              en: "No product in this category to show",
            })}
            empty
          />
        )}
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
          label={t(ABOUT)}
          second={aboutLine(d) || t({ th: "ไม่ใส่ก็ได้", en: "Optional" })}
          hint={!aboutLine(d)}
          oneLine
          onPress={() => {
            setText(d.description);
            setTerms(d.terms);
            setTab("edit");
            setTyping("description");
            setTermsTried(false);
            setStep("text");
          }}
        />
      </Group>
      {props.start && canDeleteCategory(props.start) && (
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

const BOX_MIN = 140;

const styles = StyleSheet.create({
  textCard: { borderRadius: 20, paddingVertical: 14, paddingHorizontal: SPACE.l },
  typing: { borderWidth: 2 },
  lines: { lineHeight: 24 },
  input: { textAlignVertical: "top", outlineStyle: "none" } as object,
  label: { marginBottom: -6, paddingHorizontal: SPACE.l },
  note: { marginTop: -4, paddingHorizontal: SPACE.l },
  button: { marginTop: SPACE.xs },
});
