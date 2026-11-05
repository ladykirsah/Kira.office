import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  draftOf,
  FEE_ROWS,
  percentText,
  readDraft,
  type FeeDraft,
  type ShopeeFees,
} from "@/lib/shopeeFees";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError, Note } from "../pos/fields";
import { InputRow, Line } from "../products/parts";
import { SPACE, TYPE } from "../theme";

/**
 * ค่าคอม Shopee (canvas v369): every fee Shopee charges, each with its %, then รวม — the number
 * ข้อมูลร้าน's row shows. The owner types and saves; anyone else sees the same rows as plain values.
 */
export function ShopeeFeesSheet(props: {
  fees: ShopeeFees;
  owner: boolean;
  onSave: (fees: ShopeeFees) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [draft, setDraft] = useState<FeeDraft>(() => draftOf(props.fees));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trouble, setTrouble] = useState(false);
  const read = readDraft(draft);
  const problems = tried ? read.problems : {};
  // รวม follows the boxes as they are typed, over 100% too; a box that isn't a number leaves a dash.
  const total = read.totalBp === null ? "—" : percentText(read.totalBp);

  const save = async () => {
    setTried(true);
    if (!read.fees || saving) return;
    setSaving(true);
    setTrouble(false);
    try {
      await props.onSave(read.fees);
      props.onClose();
    } catch {
      setTrouble(true);
      setSaving(false);
    }
  };

  return (
    <Sheet title={t({ th: "ค่าคอม Shopee", en: "Shopee fees" })} onClose={props.onClose}>
      <Group>
        {FEE_ROWS.map(({ key, label }) => (
          <View key={key}>
            <InputRow
              label={t(label)}
              value={draft[key]}
              unit="%"
              placeholder="0"
              keyboardType="decimal-pad"
              boxWidth={64}
              editable={props.owner}
              onChange={(v) => setDraft((now) => ({ ...now, [key]: v }))}
            />
            {problems[key] && <FieldError text={t(problems[key]!)} />}
          </View>
        ))}
        <Line
          label={t({ th: "รวม", en: "Total" })}
          right={<Text style={[TYPE.headline, styles.nums, { color: theme.text }]}>{total}</Text>}
          last
        />
        {problems.total && <FieldError text={t(problems.total)} />}
      </Group>
      <Note>
        {t({
          th: "หักจากราคา Shopee ของทุกสินค้า ตอนคิดกำไร",
          en: "Taken off every product's Shopee price for its profit",
        })}
      </Note>
      {trouble && (
        <FieldError text={t({ th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Not saved. Try again" })} />
      )}
      {props.owner && (
        <View style={styles.button}>
          <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void save()} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  nums: { fontVariant: ["tabular-nums"] },
  button: { marginTop: SPACE.xs },
});
