import { StyleSheet, Text, View } from "react-native";
import { changeText, leftText, movementLabel, type Movement } from "@/lib/stockHistory";
import { useLang, useTheme } from "../AppProviders";
import { DeskCard } from "../desk/DeskCard";
import { NameCell } from "../desk/NameCell";
import { Table, type TableColumn } from "../desk/Table";
import { TYPE } from "../theme";

/**
 * One day of ประวัติซื้อขาย on a computer (DeskStock board, 4 Nov 2026): a row per change — photo,
 * the full name on two lines with its code, what happened, what is left, the change in its grey
 * badge — and the whole row opens the change's details. No clock time (owner).
 */
export function MovementsTable(props: {
  rows: readonly Movement[];
  onOpen: (m: Movement) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const grey = [TYPE.subhead, styles.nums, { color: theme.textMuted }];
  const columns: TableColumn<Movement>[] = [
    {
      key: "product",
      label: "",
      cell: (m) => (
        <NameCell name={m.productName} code={m.productRef ?? undefined} imageKey={m.imageKey} />
      ),
    },
    {
      key: "what",
      label: "",
      width: 140,
      cell: (m) => (
        <Text style={grey} numberOfLines={1}>
          {t(movementLabel(m.movementType))}
        </Text>
      ),
    },
    {
      key: "left",
      label: "",
      width: 90,
      align: "right",
      cell: (m) => (
        <Text style={grey} numberOfLines={1}>
          {t(leftText(m.quantityAfter))}
        </Text>
      ),
    },
    {
      key: "change",
      label: "",
      width: 60,
      align: "right",
      cell: (m) => (
        <View style={[styles.badge, { backgroundColor: theme.bg }]}>
          <Text style={[TYPE.subhead, styles.nums, { color: theme.text }]}>
            {changeText(m.quantityDelta)}
          </Text>
        </View>
      ),
    },
  ];
  return (
    <DeskCard pad={4}>
      <Table
        noHead
        columns={columns}
        rows={props.rows}
        rowKey={(m) => m.id}
        onPress={props.onOpen}
        rowLabel={(m) =>
          `${m.productName}, ${t(movementLabel(m.movementType))}, ${changeText(m.quantityDelta)}, ${t(leftText(m.quantityAfter))}`
        }
      />
    </DeskCard>
  );
}

const styles = StyleSheet.create({
  nums: { fontVariant: ["tabular-nums"] },
  badge: {
    height: 30,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
