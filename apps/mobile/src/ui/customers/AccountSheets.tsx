import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { longDate } from "@/lib/customerPage";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group, Row } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { RADIUS, SPACE, TYPE } from "../theme";
import type { AccountPage } from "./useAccountPage";

/** การยินยอมรับข่าวสาร: withdraw it, or record it when the customer really agreed. */
export function ConsentSheet({ page }: { page: AccountPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const at = page.detail?.customer?.marketingConsentAt ?? null;
  return (
    <Sheet
      title={t({ th: "การยินยอมรับข่าวสาร", en: "Marketing consent" })}
      onClose={() => page.setSheet(null)}
    >
      <Text style={[TYPE.subhead, styles.say, { color: theme.textMuted }]}>
        {t({
          th: "ส่ง LINE / SMS / อีเมลโปรโมชัน ต้องได้รับความยินยอมแยกจากนโยบายความเป็นส่วนตัวตอนสมัคร · บันทึกเมื่อลูกค้ายินยอมจริงเท่านั้น",
          en: "Promotions by LINE / SMS / email need consent apart from the privacy policy at sign-up · record it only when the customer really agreed",
        })}
      </Text>
      <Group>
        <Row
          label={t({ th: "ตอนนี้", en: "Now" })}
          value={
            at
              ? t({ th: `ยินยอมแล้ว · ${t(longDate(at))}`, en: `Agreed · ${t(longDate(at))}` })
              : t({ th: "ยังไม่ยินยอม", en: "Not agreed" })
          }
          last
        />
      </Group>
      <View style={styles.go}>
        <BigButton
          label={
            at
              ? t({ th: "ถอนการยินยอม", en: "Withdraw consent" })
              : t({ th: "บันทึกการยินยอม", en: "Record consent" })
          }
          onPress={() => void page.toggleMarketing()}
        />
      </View>
      {/* With no consent yet, the sentence above already says when to record it. */}
      {at && (
        <Text style={[TYPE.footnote, styles.center, { color: theme.textMuted }]}>
          {t({
            th: "ถอนเมื่อลูกค้าขอเลิกรับข่าวสาร · ร้านจะไม่ส่งโปรโมชันให้อีก",
            en: "Withdraw when the customer asks · the shop sends no more promotions",
          })}
        </Text>
      )}
    </Sheet>
  );
}

const CONFIRM_WORD = "ลบ";

/** ลบข้อมูลตาม PDPA: typed ลบ first; it cannot be undone, and the orders stay (tax records). */
export function EraseSheet({ page }: { page: AccountPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [typed, setTyped] = useState("");
  const [tried, setTried] = useState(false);
  const ok = typed.trim() === CONFIRM_WORD;
  const go = async () => {
    setTried(true);
    if (!ok) return;
    if (await page.erase()) {
      router.canGoBack() ? router.back() : router.replace("/customers" as never);
    }
  };
  return (
    <Sheet
      title={t({ th: "ลบข้อมูลตาม PDPA", en: "Erase data (PDPA)" })}
      onClose={() => page.setSheet(null)}
    >
      <Text style={[TYPE.subhead, styles.say, { color: theme.textMuted }]}>
        {t({
          th: "ใช้เมื่อลูกค้าขอให้ลบข้อมูล · ล้างชื่อ เบอร์ อีเมล และการเชื่อม LINE แล้วปิดบัญชี · คำสั่งซื้อยังอยู่ เพราะกฎหมายให้เก็บหลักฐานภาษี",
          en: "For a customer's erase request · clears name, phone, email and the LINE link, then closes the account · orders stay, as tax records must be kept",
        })}
      </Text>
      <View style={styles.warn}>
        <LineIcon d={ICON.alert} color={theme.danger} size={16} strokeWidth={2.2} />
        <Text style={[TYPE.subhead, { color: theme.danger }]}>
          {t({ th: "ทำแล้วย้อนกลับไม่ได้", en: "This cannot be undone" })}
        </Text>
      </View>
      <View style={[styles.field, { backgroundColor: theme.surface }]}>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          placeholder={t({ th: "พิมพ์ ลบ", en: "Type ลบ" })}
          placeholderTextColor={theme.textFaint}
          accessibilityLabel={t({ th: "พิมพ์ ลบ เพื่อยืนยัน", en: "Type ลบ to confirm" })}
          autoCorrect={false}
          style={[TYPE.body, styles.confirm, { color: theme.text }]}
        />
      </View>
      <Text
        style={[
          TYPE.footnote,
          styles.hint,
          { color: tried && !ok ? theme.danger : theme.textMuted },
        ]}
      >
        {t({ th: "พิมพ์ ลบ เพื่อยืนยัน", en: "Type ลบ to confirm" })}
      </Text>
      <View style={styles.go}>
        <BigButton
          label={t({ th: "ลบข้อมูลลูกค้า", en: "Erase customer data" })}
          onPress={() => void go()}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  say: { marginBottom: SPACE.l, marginHorizontal: SPACE.xs },
  go: { marginTop: SPACE.xxl, marginBottom: SPACE.s },
  center: { textAlign: "center", marginHorizontal: SPACE.l },
  warn: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginBottom: SPACE.m },
  field: {
    borderRadius: RADIUS.field,
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: SPACE.l,
  },
  hint: { marginTop: SPACE.s, marginHorizontal: SPACE.l },
  confirm: { paddingVertical: 0, outlineStyle: "none" } as never,
});
