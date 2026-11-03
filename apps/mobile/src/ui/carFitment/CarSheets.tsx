import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  modelDraft,
  modelProblems,
  titleOf,
  type CarBrand,
  type ModelDraft,
} from "@/lib/carFitmentPage";
import { useLang } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { InputRow } from "../products/parts";
import { PictureCard, ValueRow } from "../partsSetup/parts";
import type { SaveResult } from "../partsSetup/usePartsSetup";
import { SPACE } from "../theme";

const used = (n: number) =>
  n > 0 ? { th: `${n} สินค้า`, en: `${n} products` } : { th: "ยังไม่มีสินค้า", en: "None yet" };

/** ⓘ on a brand's page: its รูปปก, names, how many models and products; แก้ไข opens the form. */
export function CarBrandDetailsSheet(props: {
  brand: CarBrand;
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
        name={t({ th: "รูปปก", en: "Cover" })}
        imageKey={b.imageKey}
        note={b.imageKey ? undefined : t({ th: "ยังไม่มีรูป", en: "No photo yet" })}
      />
      <Group>
        <ValueRow label={t({ th: "ชื่อไทย", en: "Thai name" })} value={b.nameTh ?? "—"} />
        <ValueRow label={t({ th: "ชื่ออังกฤษ", en: "English name" })} value={b.nameEn} last />
      </Group>
      <Group>
        <ValueRow
          label={t({ th: "รุ่น", en: "Models" })}
          value={t({ th: `${b.models.length} รุ่น`, en: `${b.models.length}` })}
        />
        <ValueRow label={t({ th: "ใช้ใน", en: "Used in" })} value={t(used(b.productCount))} last />
      </Group>
    </Sheet>
  );
}

/**
 * ＋ on a brand's page: เพิ่มรุ่น with its brand, names and years (ปีสิ้นสุด ไม่บังคับ). Service info
 * is added afterwards on the model's own page.
 */
export function AddModelSheet(props: {
  brand: CarBrand;
  onSave: (d: ModelDraft) => Promise<SaveResult>;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [d, setD] = useState<ModelDraft>(() => modelDraft());
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState(false);
  // A second quick tap on บันทึก lands before the page redraws, so the guard can't be a state.
  const busy = useRef(false);
  const problems = tried ? modelProblems(d, props.brand.models) : {};
  const set = (patch: Partial<ModelDraft>) => setD((now) => ({ ...now, ...patch }));
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  const save = async () => {
    setTried(true);
    if (busy.current || Object.keys(modelProblems(d, props.brand.models)).length > 0) return;
    busy.current = true;
    setRefused(false);
    const out = await props.onSave(d);
    busy.current = false;
    if (out === "failed") setRefused(true);
  };

  return (
    <Sheet title={t({ th: "เพิ่มรุ่น", en: "Add a model" })} onClose={props.onClose}>
      <Group>
        <ValueRow label={t({ th: "ยี่ห้อ", en: "Brand" })} value={titleOf(props.brand)} />
        <InputRow
          label={t({ th: "ชื่อไทย", en: "Thai name" })}
          value={d.nameTh}
          placeholder={t({ th: "เช่น ยาริส เอทีฟ", en: "e.g. ยาริส เอทีฟ" })}
          onChange={(nameTh) => set({ nameTh })}
        />
        <InputRow
          label={t({ th: "ชื่ออังกฤษ", en: "English name" })}
          value={d.nameEn}
          placeholder={t({ th: "เช่น Yaris Ativ", en: "e.g. Yaris Ativ" })}
          onChange={(nameEn) => set({ nameEn })}
          last
        />
      </Group>
      {problems.nameEn && <FieldError text={t(problems.nameEn)} />}
      <Group>
        <InputRow
          label={t({ th: "ปีเริ่ม", en: "From" })}
          value={d.yearFrom}
          placeholder={t({ th: "เช่น 2022", en: "e.g. 2022" })}
          keyboardType="number-pad"
          onChange={(v) => set({ yearFrom: digits(v) })}
        />
        <InputRow
          label={t({ th: "ปีสิ้นสุด", en: "To" })}
          value={d.yearTo}
          placeholder={t({ th: "ไม่บังคับ", en: "Optional" })}
          keyboardType="number-pad"
          onChange={(v) => set({ yearTo: digits(v) })}
          last
        />
      </Group>
      {problems.yearFrom && <FieldError text={t(problems.yearFrom)} />}
      <View style={styles.button}>
        <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void save()} />
      </View>
      {refused && (
        <FieldError text={t({ th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Not saved, try again" })} />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({ button: { marginTop: SPACE.xs } });
