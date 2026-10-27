import type { Phrase } from "@l-shopee/shared/lang";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { RADIUS, SPACE, TYPE } from "../theme";
import { BarcodeView } from "./BarcodeView";

const SEARCH_ICON = "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5";
const CHECK_ICON = "M5 12.5l4.5 4.5L19 7.5";

/** No product has the scanned code; the pinned เพิ่มสินค้า button is the next step. */
export function NotFoundCard({ code }: { code: string }) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <>
      <View style={[styles.card, styles.notFound, { backgroundColor: theme.surface }]}>
        <View style={styles.rowCenter}>
          <View style={[styles.icon, { backgroundColor: theme.hover }]}>
            <LineIcon d={SEARCH_ICON} color={theme.text} size={18} strokeWidth={2.2} />
          </View>
          <View style={styles.text}>
            <Text style={[styles.headline, { color: theme.text }]}>
              {t({ th: "ไม่พบสินค้านี้ในร้าน", en: "No product has this code" })}
            </Text>
            <Text style={[styles.subhead, { color: theme.textMuted }]} selectable>
              {t({ th: `รหัส ${code}`, en: `Code ${code}` })}
            </Text>
          </View>
        </View>
        <View style={styles.barcode}>
          <BarcodeView value={code} />
        </View>
      </View>
      <Hint
        text={t({
          th: "กดเพิ่มสินค้า แล้วไปหน้าเพิ่มสินค้า รหัสนี้กรอกไว้ให้แล้ว · ใช้ได้ทุกแท็บ",
          en: "Add product opens Add product with this code filled in · works on every tab",
        })}
      />
    </>
  );
}

export interface Notice {
  tone: "done" | "problem";
  text: Phrase;
  /** A follow-up the person can tap, e.g. "open the bill" when the browser blocked the new tab. */
  action?: { label: Phrase; onPress: () => void };
}

/** What just happened, as an icon and plain words — the guide's status rule, never coloured text. */
export function NoticeCard({ notice }: { notice: Notice }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const done = notice.tone === "done";
  return (
    <View
      style={[styles.card, styles.row, { backgroundColor: theme.surface }]}
      accessibilityLiveRegion="polite"
    >
      {done ? (
        <View style={[styles.badge, { backgroundColor: theme.success }]}>
          <LineIcon d={CHECK_ICON} color="#FFFFFF" size={14} strokeWidth={3} />
        </View>
      ) : (
        <View style={[styles.badge, { backgroundColor: theme.danger }]}>
          <Text style={styles.bang}>!</Text>
        </View>
      )}
      <View style={styles.text}>
        <Text style={[styles.body, { color: theme.text }]}>{t(notice.text)}</Text>
        {notice.action && (
          <Pressable onPress={notice.action.onPress} accessibilityRole="link" style={styles.link}>
            <Text style={[styles.subhead, { color: theme.primary }]}>{t(notice.action.label)}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** A grey footnote under a card. */
export function Hint({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.hint, { color: theme.textMuted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, padding: SPACE.l, marginTop: SPACE.m, gap: 2 },
  notFound: { minHeight: 142 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.m },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: SPACE.m },
  text: { flex: 1, gap: 2 },
  barcode: { marginTop: SPACE.m, alignItems: "center" },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  bang: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", lineHeight: 18 },
  headline: { ...TYPE.headline },
  body: { ...TYPE.body },
  subhead: { ...TYPE.subhead },
  link: { marginTop: SPACE.xs, alignSelf: "flex-start" },
  hint: { ...TYPE.footnote, marginTop: 10, marginHorizontal: SPACE.xs },
});
