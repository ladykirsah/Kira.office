import { Pressable, StyleSheet, Text, View } from "react-native";
import { LABEL_WIDTH_MM } from "@/lib/barcodeLabel";
import { cardLine, type SheetItem } from "@/lib/labelList";
import { useLang, useTheme } from "../AppProviders";
import { Columns } from "../desk/Columns";
import { DeskCard } from "../desk/DeskCard";
import { Table, type TableColumn } from "../desk/Table";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Stepper } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { PaperChoices } from "./PaperChoices";
import { LabelArt } from "./LabelArt";
import type { Barcodes } from "./useBarcodes";
import { CodeCopy } from "../CodeCopy";

/** The phone card's label scale: one for all, so L shows wider than S as on paper. */
const CARD_PX_PER_MM = 2.6;

/**
 * ออกบาร์โค้ด on a computer (DeskBarcodes board, 4 Nov 2026): บนแผ่น as one card of rows — the label
 * itself on the left, the full name on two lines with "code · ป้าย L", − n + and › — and the paper
 * choices in a card on the right. The label and the words open the label's sheet; − n + is its own
 * control beside them (a button may not hold another on the web).
 */
export function BarcodesDesk({ list }: { list: Barcodes }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const opener = (item: SheetItem) => () => list.setSheet({ kind: "label", key: item.key });
  const said = (item: SheetItem) =>
    `${list.byId.get(item.productId)?.name ?? ""} · ${t({ th: "ป้าย", en: "label" })} ${item.size}`;
  // A label whose product is gone from the catalogue is left out, as on the phone.
  const items = list.items.filter((i) => list.byId.has(i.productId) && list.texts.has(i.productId));
  const columns: TableColumn<SheetItem>[] = [
    {
      key: "label",
      label: "",
      width: LABEL_WIDTH_MM.L * CARD_PX_PER_MM,
      cell: (item) => (
        <Pressable
          onPress={opener(item)}
          accessibilityRole="button"
          accessibilityLabel={said(item)}
          style={styles.art}
        >
          <LabelArt
            text={list.texts.get(item.productId)!}
            size={item.size}
            shop={list.shop}
            pxPerMm={CARD_PX_PER_MM}
          />
        </Pressable>
      ),
    },
    {
      key: "words",
      label: "",
      cell: (item) => {
        const row = list.byId.get(item.productId)!;
        return (
          <Pressable
            onPress={opener(item)}
            focusable={false}
            importantForAccessibility="no-hide-descendants"
            style={styles.words}
          >
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
              {row.name}
            </Text>
            <CodeCopy
              code={row.productRef}
              after={t(cardLine(row.productRef, item.size)).slice(row.productRef.trim().length)}
              style={[styles.sub, { color: theme.textMuted }]}
            />
          </Pressable>
        );
      },
    },
    {
      key: "qty",
      label: "",
      width: 130,
      align: "right",
      cell: (item) => (
        <Stepper
          value={item.qty}
          label={t({ th: "จำนวนป้าย", en: "labels" })}
          onChange={(n) => list.setQty(item.key, n)}
        />
      ),
    },
    {
      key: "open",
      label: "",
      width: 14,
      align: "right",
      cell: (item) => (
        <Pressable
          onPress={opener(item)}
          focusable={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.chevron}
        >
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={14} strokeWidth={2.4} />
        </Pressable>
      ),
    },
  ];
  return (
    <View style={styles.top}>
      <Columns
        sideWidth={400}
        side={
          <DeskCard pad={4}>
            <PaperChoices list={list} />
          </DeskCard>
        }
      >
        <DeskCard title={t({ th: "บนแผ่น", en: "On the sheet" })} pad={4}>
          <Table noHead columns={columns} rows={items} rowKey={(i) => i.key} minRowHeight={96} />
        </DeskCard>
      </Columns>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { marginTop: SPACE.l },
  art: { alignItems: "center", paddingVertical: SPACE.xs },
  words: { alignSelf: "stretch", justifyContent: "center", gap: SPACE.xs, minHeight: 80 },
  name: { fontSize: 14, lineHeight: 20 },
  sub: { ...TYPE.footnote },
  chevron: { alignSelf: "stretch", justifyContent: "center", minHeight: 80 },
});
