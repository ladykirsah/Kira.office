import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { API_BASE } from "@/lib/config";
import { refundBill } from "@/lib/financeApi";
import { billTitle, money, type Bill } from "@/lib/financePage";
import { dayPill } from "@/lib/orderList";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { Line } from "../products/parts";
import { CopyIcon } from "../staff/parts";
import { SPACE, TYPE } from "../theme";

type Step = "bill" | "refund";

/**
 * Tap a bill (canvas v298, row 2): its number with the copy mark, ทะเบียน (plate + province) ·
 * วันที่ (no time) · ยอด · กำไร, ดูบิล, and คืนเงิน — which asks first and names the money. Once
 * refunded the list says ● คืนเงินแล้ว.
 */
export function BillSheets(props: {
  bill: Bill;
  onClose: () => void;
  onRefunded: () => void;
  onFailed: (reason: string) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [step, setStep] = useState<Step>("bill");
  const [busy, setBusy] = useState(false);
  const { bill } = props;
  const number = bill.saleNumber ?? "—";

  const refund = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await refundBill(fetch, API_BASE, token, bill.id);
      props.onRefunded();
    } catch (e) {
      props.onFailed(e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  };

  if (step === "refund") {
    const goods =
      bill.partLineCount > 0
        ? t({
            th: `สินค้า ${bill.partLineCount} รายการกลับเข้าสต็อก · ทำย้อนไม่ได้`,
            en: `${bill.partLineCount} goods lines go back to stock · can't be undone`,
          })
        : t({ th: "ทำย้อนไม่ได้", en: "Can't be undone" });
    return (
      <Sheet
        title={t({ th: `คืนเงินบิล ${number}?`, en: `Refund bill ${number}?` })}
        sub={goods}
        onClose={props.onClose}
        noPill
      >
        <BigButton label={t({ th: "คืนเงิน", en: "Refund" })} onPress={() => void refund()} />
        <BigButton label={t({ th: "ยกเลิก", en: "Cancel" })} kind="grey" onPress={props.onClose} />
      </Sheet>
    );
  }

  const who = bill.licensePlate
    ? { label: t({ th: "ทะเบียน", en: "Plate" }), value: t(billTitle(bill)) }
    : { label: t({ th: "ลูกค้า", en: "Customer" }), value: t(billTitle(bill)) };
  const value = (text: string) => (
    <Text style={[TYPE.body, styles.value, { color: theme.text }]}>{text}</Text>
  );
  return (
    <Sheet
      title={number}
      titleTool={
        bill.saleNumber ? (
          <CopyIcon value={bill.saleNumber} what={{ th: "เลขบิล", en: "bill number" }} />
        ) : undefined
      }
      onClose={props.onClose}
    >
      <Group>
        <Line label={who.label} right={value(who.value)} />
        <Line label={t({ th: "วันที่", en: "Date" })} right={value(t(dayPill(bill.createdAt)))} />
        <Line label={t({ th: "ยอด", en: "Total" })} right={value(money(bill.grandTotalSatang))} />
        <Line
          label={t({ th: "กำไร", en: "Profit" })}
          right={value(money(bill.grossProfitSatang))}
          last
        />
      </Group>
      {bill.licensePlate ? (
        <BigButton
          label={t({ th: "ดูบิล", en: "View the bill" })}
          kind="grey"
          onPress={() => {
            props.onClose();
            router.push(
              `/customers/${encodeURIComponent(bill.licensePlate!)}/${encodeURIComponent(bill.id)}` as never,
            );
          }}
        />
      ) : null}
      {bill.saleStatus === "completed" ? (
        <Group>
          <Pressable
            onPress={() => setStep("refund")}
            accessibilityRole="button"
            style={styles.row}
          >
            <Text style={[TYPE.body, { color: theme.danger }]}>
              {t({ th: "คืนเงิน", en: "Refund" })}
            </Text>
          </Pressable>
        </Group>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  value: { flexShrink: 1, textAlign: "right" },
  row: { minHeight: 52, paddingHorizontal: SPACE.l, justifyContent: "center" },
});
