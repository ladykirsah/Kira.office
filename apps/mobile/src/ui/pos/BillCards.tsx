import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { formatBaht } from "@/lib/money";
import { discountOf, lineTotal, subtotal, type PosLine } from "@/lib/posBill";
import { billDate } from "@/lib/scanSale";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { RADIUS, SPACE, TYPE } from "../theme";
import { ChoiceRow, FieldError, Heading, Note } from "./fields";
import { usePos } from "./PosSessionProvider";

const WRENCH =
  "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z";

/** รายการ — each line with its photo, a › to edit it, the stepper and its total. */
export function ItemsSection() {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const lines = pos.bill.lines;
  const shortCount = lines.filter(
    (l) => l.variantId && pos.short[l.variantId] !== undefined,
  ).length;
  return (
    <>
      {shortCount > 0 && (
        <View style={[styles.banner, { backgroundColor: theme.surface }]} accessibilityRole="alert">
          <LineIcon d={ICON.alert} color={theme.danger} size={18} strokeWidth={2.4} />
          <Text style={[TYPE.subhead, { color: theme.danger, flex: 1 }]}>
            {t({
              th: `ของไม่พอ ${shortCount} รายการ · แก้แล้วกดชำระเงินอีกครั้ง`,
              en: `${shortCount} item short · fix it, then pay again`,
            })}
          </Text>
        </View>
      )}
      <Heading
        text={
          lines.length > 0
            ? t({ th: `รายการ (${lines.length})`, en: `Items (${lines.length})` })
            : t({ th: "รายการ", en: "Items" })
        }
      />
      {lines.length > 0 && (
        <Group>
          {lines.map((l, i) => (
            <LineRow key={l.key} line={l} last={i === lines.length - 1} />
          ))}
        </Group>
      )}
      {pos.tried && pos.missing.includes("lines") && (
        <FieldError
          text={t({ th: "เพิ่มสินค้าหรือบริการก่อน", en: "Add a part or service first" })}
        />
      )}
      <View style={styles.addRow}>
        <AddButton
          label={t({ th: "เพิ่มสินค้า", en: "Add part" })}
          dark
          onPress={() => pos.setSheet("part")}
        />
        <AddButton
          label={t({ th: "เพิ่มบริการ", en: "Add service" })}
          onPress={() => pos.setSheet("service")}
        />
      </View>
      {lines.length === 0 && (
        <Note>
          {t({
            th: "ยังไม่มีรายการ · แตะเพิ่มสินค้า แล้วสแกนหรือค้นหาได้",
            en: "No items yet · tap Add part to scan or search",
          })}
        </Note>
      )}
    </>
  );
}

function AddButton(props: { label: string; onPress: () => void; dark?: boolean }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      style={[styles.add, { backgroundColor: props.dark ? theme.text : theme.hover }]}
    >
      <LineIcon
        d={ICON.plus}
        color={props.dark ? theme.bg : theme.text}
        size={16}
        strokeWidth={2.4}
      />
      <Text
        style={[TYPE.subhead, { color: props.dark ? theme.bg : theme.text, fontWeight: "600" }]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function LineRow({ line, last }: { line: PosLine; last: boolean }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const available = line.variantId ? pos.short[line.variantId] : undefined;
  const short = available !== undefined;
  const sub = [line.productRef, `${formatBaht(line.priceSatang)} × ${line.quantity}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <View
      style={[
        styles.line,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      {line.photoKey ? (
        <Image
          source={{ uri: `${API_BASE}/img/${line.photoKey}` }}
          style={[styles.photo, { backgroundColor: theme.bg }]}
        />
      ) : (
        <View style={[styles.photo, styles.photoEmpty, { backgroundColor: theme.bg }]}>
          <LineIcon
            d={line.kind === "service" ? WRENCH : ICON.box}
            color={theme.textMuted}
            size={24}
          />
        </View>
      )}
      <View style={styles.lineBody}>
        <Pressable
          onPress={() => pos.setSheet({ line: line.key })}
          accessibilityRole="button"
          accessibilityLabel={t({ th: `แก้ ${line.name}`, en: `Edit ${line.name}` })}
          style={styles.nameRow}
        >
          <Text style={[TYPE.headline, { color: theme.text, flex: 1 }]}>
            {line.name}
            {line.kind === "service" ? (
              <Text style={[TYPE.footnote, { color: theme.textMuted, fontWeight: "400" }]}>
                {t({ th: " · บริการ", en: " · service" })}
              </Text>
            ) : null}
          </Text>
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        </Pressable>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{sub}</Text>
        <View style={styles.stepRow}>
          <View style={[styles.stepper, short && { borderColor: theme.danger, borderWidth: 1.5 }]}>
            <StepButton
              label={t({ th: "ลดจำนวน", en: "Less" })}
              d="M5 12h14"
              onPress={() => pos.step(line.key, -1)}
            />
            <Text style={[TYPE.headline, styles.qty, { color: theme.text }]}>{line.quantity}</Text>
            <StepButton
              label={t({ th: "เพิ่มจำนวน", en: "More" })}
              d={ICON.plus}
              onPress={() => pos.step(line.key, 1)}
            />
          </View>
          <Text style={[TYPE.headline, { color: theme.text }]}>{formatBaht(lineTotal(line))}</Text>
        </View>
        {short && (
          <FieldError
            text={t({
              th: `ในร้านเหลือ ${available} ชิ้น · ลดจำนวน หรือลบรายการ`,
              en: `${available} left in the shop · lower it or remove the item`,
            })}
          />
        )}
      </View>
    </View>
  );
}

function StepButton(props: { label: string; d: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      hitSlop={6}
      style={[styles.step, { backgroundColor: theme.hover }]}
    >
      <LineIcon d={props.d} color={theme.text} size={16} strokeWidth={2.4} />
    </Pressable>
  );
}

/** สรุปยอด — the subtotal, the whole-bill discount (tap to change), the total. */
export function SummarySection() {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const sub = subtotal(pos.bill.lines);
  const off = discountOf(sub, pos.bill.discount);
  const quote = pos.bill.doc === "quote";
  return (
    <>
      <Heading text={t({ th: "สรุปยอด", en: "Summary" })} />
      <Group>
        <SumRow label={t({ th: "รวมย่อย", en: "Subtotal" })} value={formatBaht(sub)} />
        {off > 0 ? (
          <ChoiceRow
            label={t({ th: "ส่วนลด", en: "Discount" })}
            value={`−${formatBaht(off)}`}
            onPress={() => pos.setSheet("discount")}
          />
        ) : (
          <ChoiceRow
            label={t({ th: "เพิ่มส่วนลด", en: "Add a discount" })}
            action
            onPress={() => pos.setSheet("discount")}
          />
        )}
        <SumRow
          label={
            quote
              ? t({ th: "รวมโดยประมาณ", en: "Estimated total" })
              : t({ th: "รวมทั้งสิ้น", en: "Total" })
          }
          value={formatBaht(sub - off)}
          bold
          last
          color={theme.text}
        />
      </Group>
    </>
  );
}

function SumRow(props: {
  label: string;
  value: string;
  bold?: boolean;
  last?: boolean;
  color?: string;
}) {
  const { theme } = useTheme();
  const style = props.bold ? TYPE.headline : TYPE.body;
  return (
    <View
      style={[
        styles.sum,
        !props.last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Text style={[style, { color: theme.text, flex: 1 }]}>{props.label}</Text>
      <Text style={[style, { color: props.color ?? theme.textMuted }]}>{props.value}</Text>
    </View>
  );
}

/** ตั้งค่าบิล and ดูบิล — what the printed bill says, and its file before payment. */
export function SettingsSection() {
  const { t } = useLang();
  const pos = usePos();
  const quote = pos.bill.doc === "quote";
  const date = billDate(pos.print.date ?? Date.now()).date;
  return (
    <>
      <Heading
        text={
          quote
            ? t({ th: "ตั้งค่าใบเสนอราคา", en: "Quotation settings" })
            : t({ th: "ตั้งค่าบิล", en: "Bill settings" })
        }
      />
      <Group>
        <ChoiceRow
          label={t({ th: "หมายเหตุบนบิล", en: "Note on the bill" })}
          sub={
            pos.bill.note ||
            t({
              th: "ไม่บังคับ · เช่น รับประกันคอมเพรสเซอร์ 6 เดือน",
              en: "Optional · e.g. 6-month compressor warranty",
            })
          }
          onPress={() => pos.setSheet("note")}
        />
        <ChoiceRow
          label={t({ th: "วันที่ในบิล", en: "Date on the bill" })}
          value={date}
          onPress={() => pos.setSheet("date")}
        />
        {!quote && (
          <ChoiceRow
            label={t({ th: "แบบบิล", en: "Bill type" })}
            value={
              pos.print.style === "receipt"
                ? t({ th: "ใบเสร็จ", en: "Receipt" })
                : t({ th: "ใบแจ้งหนี้", en: "Invoice" })
            }
            onPress={() => pos.setSheet("style")}
          />
        )}
        <ChoiceRow
          label={t({ th: "ภาษา", en: "Language" })}
          value={pos.print.lang === "th" ? "ไทย" : "English"}
          onPress={() => pos.setSheet("language")}
          last
        />
      </Group>
      <Heading
        text={
          quote
            ? t({ th: "ดูใบเสนอราคา", en: "See the quotation" })
            : t({ th: "ดูบิล", en: "See the bill" })
        }
      />
      <Group>
        <ChoiceRow
          label={t({ th: "ดูบิล · บันทึก PDF / รูป", en: "See it · save PDF / picture" })}
          onPress={() => pos.setSheet("preview")}
          last
        />
      </Group>
      {!quote && (
        <Note>
          {t({
            th: "ส่งบิลก่อนรับเงิน = เก็บเป็นใบเสนอราคาในประวัติลูกค้า ยังไม่นับยอดขาย",
            en: "Sending the bill before payment keeps it as a quotation; it is not a sale yet",
          })}
        </Note>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
    padding: SPACE.l,
    borderRadius: RADIUS.card,
  },
  addRow: { flexDirection: "row", gap: SPACE.s, marginTop: SPACE.m },
  add: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  line: { flexDirection: "row", gap: 14, paddingHorizontal: SPACE.l, paddingVertical: SPACE.m },
  photo: { width: 56, height: 56, borderRadius: RADIUS.thumb },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  lineBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  stepRow: {
    marginTop: SPACE.s,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 19,
    padding: 2,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  step: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  qty: { minWidth: 28, textAlign: "center" },
  sum: { minHeight: 52, paddingHorizontal: SPACE.l, flexDirection: "row", alignItems: "center" },
});
