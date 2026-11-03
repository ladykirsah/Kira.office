import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { Phrase } from "@l-shopee/shared/lang";
import {
  nameDraft,
  nameProblems,
  titleOf,
  type Brand,
  type NameDraft,
  type PartName,
  type SystemRow,
} from "@/lib/partsSetupPage";
import { useLang } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { InputRow } from "../products/parts";
import { photoPreview, pickPhoto } from "../products/pickPhoto";
import { SPACE } from "../theme";
import { DeleteRow, PictureCard, ValueRow } from "./parts";
import type { PictureChange, SaveResult } from "./usePartsSetup";

export const WRONG_PICTURE: Phrase = {
  th: "รูปต้องเป็น JPG PNG หรือ WebP ไม่เกิน 5MB",
  en: "Use a JPG, PNG or WebP up to 5MB",
};
const NOT_SAVED: Phrase = { th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Not saved, try again" };
const used = (n: number): Phrase =>
  n > 0 ? { th: `${n} สินค้า`, en: `${n} products` } : { th: "ยังไม่มีสินค้า", en: "None yet" };

/** A tapped brand: its logo, its names, how many products use it; แก้ไข opens the form. */
export function BrandDetailsSheet(props: {
  brand: Brand;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const b = props.brand;
  return (
    <Sheet
      title={titleOf(b)}
      onClose={props.onClose}
      right={{ label: t({ th: "แก้ไข", en: "Edit" }), onPress: props.onEdit }}
    >
      <PictureCard
        name={t({ th: "โลโก้", en: "Logo" })}
        imageKey={b.imageKey}
        note={b.imageKey ? undefined : t({ th: "ยังไม่มีรูป", en: "No photo yet" })}
      />
      <Group>
        <ValueRow label={t({ th: "ชื่อไทย", en: "Thai name" })} value={b.nameTh ?? "—"} />
        <ValueRow label={t({ th: "ชื่ออังกฤษ", en: "English name" })} value={b.nameEn} last />
      </Group>
      <Group>
        <ValueRow label={t({ th: "ใช้ใน", en: "Used in" })} value={t(used(b.productCount))} last />
      </Group>
    </Sheet>
  );
}

/** A tapped system (ⓘ on its page): names and what it holds; แก้ไข opens the form. */
export function SystemDetailsSheet(props: {
  row: SystemRow;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const s = props.row;
  return (
    <Sheet
      title={titleOf(s)}
      onClose={props.onClose}
      right={{ label: t({ th: "แก้ไข", en: "Edit" }), onPress: props.onEdit }}
    >
      <Group>
        <ValueRow label={t({ th: "ชื่อไทย", en: "Thai name" })} value={s.nameTh ?? "—"} />
        <ValueRow label={t({ th: "ชื่ออังกฤษ", en: "English name" })} value={s.nameEn} last />
      </Group>
      <Group>
        <ValueRow label={t({ th: "หมวดหมู่", en: "Categories" })} value={String(s.categoryCount)} />
        <ValueRow label={t({ th: "สินค้า", en: "Products" })} value={String(s.productCount)} last />
      </Group>
    </Sheet>
  );
}

/**
 * เพิ่มยี่ห้อ / a brand's แก้ไข, and เพิ่มระบบ / แก้ระบบ: (a brand's logo,) ชื่อไทย, ชื่ออังกฤษ, then
 * ลบ… only when nothing uses it, and บันทึก. No English name, or another one's, says so under them.
 * รุ่นรถที่ใช้ได้'s car brands use it too: the same form with a รูปปก (owner, 3 Nov 2026: "use the same
 * layout and pattern as on ตั้งค่าอะไหล่").
 */
export function NameFormSheet(props: {
  kind: "brand" | "system" | "carBrand";
  start: PartName | null;
  startImageKey?: string | null;
  list: PartName[];
  canDelete: boolean;
  onSave: (d: NameDraft, change: PictureChange) => Promise<SaveResult>;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [d, setD] = useState<NameDraft>(() => nameDraft(props.start ?? undefined));
  const [change, setChange] = useState<PictureChange>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState(false);
  // A second quick tap on บันทึก lands before the page redraws, so the guard can't be a state.
  const busy = useRef(false);
  const kind = props.kind === "carBrand" ? "brand" : props.kind;
  const problems = tried ? nameProblems(kind, d, props.list) : {};
  const car = props.kind === "carBrand";
  const brand = kind === "brand";
  const title = props.start
    ? brand
      ? titleOf(props.start)
      : t({ th: "แก้ระบบ", en: "Edit system" })
    : car
      ? t({ th: "เพิ่มยี่ห้อรถ", en: "Add a car brand" })
      : brand
        ? t({ th: "เพิ่มยี่ห้อ", en: "Add a brand" })
        : t({ th: "เพิ่มระบบ", en: "Add a system" });

  const choose = async (source: "camera" | "library") => {
    const photo = await pickPhoto(source);
    if (!photo) return;
    setChange({ photo });
    setPreview(photoPreview(photo));
  };

  const save = async () => {
    setTried(true);
    if (busy.current || Object.keys(nameProblems(kind, d, props.list)).length > 0) return;
    busy.current = true;
    setRefused(false);
    const out = await props.onSave(d, change);
    busy.current = false;
    if (out === "failed") setRefused(true);
  };

  return (
    <Sheet title={title} onClose={props.onClose}>
      {brand && (
        <PictureCard
          name={car ? t({ th: "รูปปก", en: "Cover" }) : t({ th: "โลโก้", en: "Logo" })}
          imageKey={change === "remove" ? null : (props.startImageKey ?? null)}
          preview={preview}
          onChoose={(source) => void choose(source)}
          onRemove={() => {
            setChange("remove");
            setPreview(null);
          }}
        />
      )}
      <Group>
        <InputRow
          label={t({ th: "ชื่อไทย", en: "Thai name" })}
          value={d.nameTh}
          placeholder={
            car
              ? t({ th: "เช่น ซูซูกิ", en: "e.g. ซูซูกิ" })
              : brand
                ? t({ th: "เช่น เดนโซ่", en: "e.g. เดนโซ่" })
                : t({ th: "เช่น ระบบหล่อเย็น", en: "e.g. ระบบหล่อเย็น" })
          }
          onChange={(nameTh) => setD((now) => ({ ...now, nameTh }))}
        />
        <InputRow
          label={t({ th: "ชื่ออังกฤษ", en: "English name" })}
          value={d.nameEn}
          placeholder={
            car
              ? t({ th: "เช่น Suzuki", en: "e.g. Suzuki" })
              : brand
                ? t({ th: "เช่น DENSO", en: "e.g. DENSO" })
                : t({ th: "เช่น Cooling", en: "e.g. Cooling" })
          }
          onChange={(nameEn) => setD((now) => ({ ...now, nameEn }))}
          last
        />
      </Group>
      {problems.nameEn && <FieldError text={t(problems.nameEn)} />}
      {props.start && props.canDelete && (
        <DeleteRow
          label={
            brand
              ? t({ th: "ลบยี่ห้อ", en: "Delete brand" })
              : t({ th: "ลบระบบ", en: "Delete system" })
          }
          onPress={props.onDelete}
        />
      )}
      <View style={styles.button}>
        <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void save()} />
      </View>
      {refused && <FieldError text={t(NOT_SAVED)} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({ button: { marginTop: SPACE.xs } });
