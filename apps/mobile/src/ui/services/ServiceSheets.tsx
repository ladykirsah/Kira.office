import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceRow } from "@/lib/posApi";
import { deleteTitle, serviceProblems, type ServiceDraft } from "@/lib/servicesPage";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { InputRow } from "../products/parts";
import { SPACE, TYPE } from "../theme";

/**
 * เพิ่มบริการ (＋, or + เพิ่ม “…” with the words as the name) or a tapped service under its own name:
 * ชื่อบริการ · ชื่ออังกฤษ, then ราคาตั้งต้น, ลบบริการ on a saved one, and the red บันทึก. บันทึก with no name,
 * or another service's name, says so under the names; an empty price saves as ฿0.
 */
export function ServiceSheet(props: {
  start: ServiceDraft;
  list: ServiceRow[];
  /** True once saved; the sheet stays open (and says so) when the server refused. */
  onSave: (draft: ServiceDraft) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [d, setD] = useState(props.start);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState(false);
  // A second quick tap on บันทึก lands before the page redraws, so the guard can't be a state.
  const busy = useRef(false);
  const problems = tried ? serviceProblems(d, props.list) : {};
  const set = (patch: Partial<ServiceDraft>) => setD((now) => ({ ...now, ...patch }));

  const save = async () => {
    setTried(true);
    if (busy.current || Object.keys(serviceProblems(d, props.list)).length > 0) return;
    busy.current = true;
    setRefused(false);
    const saved = await props.onSave(d);
    busy.current = false;
    if (!saved) setRefused(true);
  };

  return (
    <Sheet
      title={props.start.id ? props.start.name : t({ th: "เพิ่มบริการ", en: "Add a service" })}
      onClose={props.onClose}
    >
      <Group>
        <InputRow
          label={t({ th: "ชื่อบริการ", en: "Service" })}
          value={d.name}
          placeholder={t({ th: "เช่น ล้างคอยล์ร้อน", en: "e.g. condenser cleaning" })}
          onChange={(name) => set({ name })}
        />
        <InputRow
          label={t({ th: "ชื่ออังกฤษ", en: "English name" })}
          value={d.nameEn}
          placeholder={t({ th: "ไม่บังคับ", en: "Optional" })}
          onChange={(nameEn) => set({ nameEn })}
          last
        />
      </Group>
      {problems.name && <FieldError text={t(problems.name)} />}
      <Group>
        <InputRow
          label={t({ th: "ราคาตั้งต้น", en: "Starting price" })}
          value={d.price}
          placeholder="฿"
          lead="฿"
          keyboardType="decimal-pad"
          onChange={(price) => set({ price })}
          last
        />
      </Group>
      {problems.price && <FieldError text={t(problems.price)} />}
      {props.start.id && (
        <Group>
          <Pressable onPress={props.onDelete} accessibilityRole="button" style={styles.deleteRow}>
            <Text style={[TYPE.body, { color: theme.danger }]}>
              {t({ th: "ลบบริการ", en: "Delete service" })}
            </Text>
          </Pressable>
        </Group>
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

/** ลบบริการ ล้างแอร์? — a red ลบ and a grey ยกเลิก, nothing else (as คูปอง's). */
export function DeleteServiceSheet(props: {
  name: string;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  return (
    <Sheet title={t(deleteTitle(props.name))} onClose={props.onClose} noPill>
      <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={props.onDelete} />
      <BigButton label={t({ th: "ยกเลิก", en: "Cancel" })} kind="grey" onPress={props.onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
  button: { marginTop: SPACE.xs },
});
