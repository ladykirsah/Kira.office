import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import { clearSummary } from "@/lib/paymentPage";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { SPACE, TYPE } from "../theme";
import type { PaymentPage } from "./usePaymentPage";

/**
 * ล้าง on a computer (DeskPayment board, 4 Nov 2026): a question in the middle of the screen — how
 * many and how much come off, by account, that the records stay — then ล้าง / ยกเลิก.
 */
export function ClearDialog({ page, onClose }: { page: PaymentPage; onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const sum = clearSummary(page.rows);
  const split = sum.byAccount.map((x) => `${x.label} ${formatBaht(x.satang)}`);
  const facts = [
    t({ th: `${sum.count} รายการ`, en: `${sum.count} payments` }),
    formatBaht(sum.totalSatang),
    ...split,
  ].join(" · ");
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.fill, styles.center, { backgroundColor: theme.scrim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ปิด", en: "Close" })}
        />
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.surface }]}>
          <Text style={[TYPE.headline, { color: theme.text }]} accessibilityRole="header">
            {t({ th: "ล้างรายการที่ตรวจแล้ว", en: "Clear the checked list" })}
          </Text>
          <Text style={[TYPE.subhead, { color: theme.text }]}>{facts}</Text>
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
            {t({
              th: "ล้างเมื่อตรวจกับบัญชีธนาคารแล้วว่าเงินเข้าครบ · รายการจะหายจากหน้านี้ แต่บันทึกยังเก็บไว้ทั้งหมด ดูย้อนหลังได้",
              en: "Clear once the bank shows every payment arrived · they leave this page, but every record is kept",
            })}
          </Text>
          <View style={styles.buttons}>
            <View style={styles.fill}>
              <BigButton
                label={
                  page.busy
                    ? t({ th: "กำลังล้าง…", en: "Clearing…" })
                    : t({ th: "ล้าง", en: "Clear" })
                }
                onPress={() => void page.clearAll()}
              />
            </View>
            <View style={styles.fill}>
              <BigButton label={t({ th: "ยกเลิก", en: "Cancel" })} kind="grey" onPress={onClose} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  dialog: {
    width: 400,
    borderRadius: 18,
    padding: SPACE.xl,
    gap: SPACE.s,
    boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
  },
  buttons: { flexDirection: "row", gap: 10, marginTop: SPACE.m },
});
