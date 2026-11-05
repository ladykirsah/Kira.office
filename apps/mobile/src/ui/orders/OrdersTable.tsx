import { StyleSheet, Text, View } from "react-native";
import { nextStep, orderDay, payWord, type OrderListRow } from "@/lib/orderList";
import { useLang, useTheme } from "../AppProviders";
import { DeskCard } from "../desk/DeskCard";
import { NameCell } from "../desk/NameCell";
import { Table, type TableColumn } from "../desk/Table";
import { LineIcon } from "../LineIcon";
import { SPACE, TYPE } from "../theme";
import { STEP_ICON, toneColor } from "./icons";

interface OrdersTableProps {
  orders: readonly OrderListRow[];
  now: number;
  onOpen: (o: OrderListRow) => void;
}

/**
 * ออเดอร์ on a computer (DeskOrders board, 4 Nov 2026): one row per order — who and the order number,
 * the day it was placed, what it waits for (coloured icon + black words; grey when only a status) and
 * how it is paid. No money in a row (owner, 29 Oct): it is on the order's page.
 */
export function OrdersTable({ orders, now, onOpen }: OrdersTableProps) {
  const { t } = useLang();
  const { theme } = useTheme();
  const grey = [TYPE.subhead, { color: theme.textMuted }];
  const columns: TableColumn<OrderListRow>[] = [
    {
      key: "who",
      label: t({ th: "ลูกค้า · เลขออเดอร์", en: "Customer · order" }),
      cell: (o) => (
        <NameCell
          name={o.buyerUsername || "—"}
          sub={o.externalOrderId}
          imageKey={o.firstItemImageKey}
        />
      ),
    },
    {
      key: "day",
      label: t({ th: "วันที่สั่ง", en: "Placed" }),
      width: 110,
      cell: (o) => <Text style={grey}>{t(orderDay(o, now))}</Text>,
    },
    {
      key: "step",
      label: t({ th: "ต้องทำ", en: "To do" }),
      width: 230,
      cell: (o) => {
        const step = nextStep(o.orderStatus, o.paymentStatus);
        return (
          <View style={styles.step}>
            {step.icon && (
              <LineIcon
                d={STEP_ICON[step.icon]}
                color={toneColor(step.tone, theme)}
                size={16}
                strokeWidth={2}
              />
            )}
            <Text
              style={[TYPE.subhead, { color: step.waiting ? theme.text : theme.textMuted }]}
              numberOfLines={1}
            >
              {t(step.text)}
            </Text>
          </View>
        );
      },
    },
    {
      key: "pay",
      label: t({ th: "การชำระเงิน", en: "Payment" }),
      width: 170,
      cell: (o) => (
        <Text style={grey} numberOfLines={1}>
          {t(payWord(o.paymentStatus))}
        </Text>
      ),
    },
  ];
  return (
    <DeskCard pad={4}>
      <Table
        columns={columns}
        rows={orders}
        rowKey={(o) => o.id}
        onPress={onOpen}
        rowLabel={(o) =>
          `${o.buyerUsername ?? ""} ${o.externalOrderId} ${t(nextStep(o.orderStatus, o.paymentStatus).text)}`
        }
      />
    </DeskCard>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", alignItems: "center", gap: SPACE.s - 2 },
});
