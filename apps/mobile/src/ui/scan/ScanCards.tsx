import type { Phrase } from "@l-shopee/shared/lang";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import type { ScannedPart } from "@/lib/scanList";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { RADIUS, SPACE, TYPE } from "../theme";
import { BarcodeView } from "./BarcodeView";

const SEARCH_ICON = "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5";
const CHECK_ICON = "M5 12.5l4.5 4.5L19 7.5";

/** Add new: the scanned code, which becomes both the Product ID and the barcode. */
export function AddCard({ code }: { code: string }) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.footnote, { color: theme.textMuted }]}>
        {t({ th: "รหัสสินค้า / บาร์โค้ด", en: "Product ID / barcode" })}
      </Text>
      <Text style={[styles.code, { color: theme.text }]} selectable>
        {code}
      </Text>
      <View style={styles.barcode}>
        <BarcodeView value={code} />
      </View>
    </View>
  );
}

/** View: the part's price and stock at a glance, before opening its full page. */
export function FoundCard({ part, imageUrl }: { part: ScannedPart; imageUrl: string | null }) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <View style={[styles.card, styles.row, { backgroundColor: theme.surface }]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, { backgroundColor: theme.hover }]} />
      )}
      <View style={styles.text}>
        <Text style={[styles.headline, { color: theme.text }]} numberOfLines={2}>
          {part.name}
        </Text>
        <Text style={[styles.subhead, { color: theme.textMuted }]}>
          {part.productRef} · {formatBaht(part.unitPriceSatang)}
        </Text>
        <Text style={[styles.subhead, { color: theme.textMuted }]}>
          {t({
            th: `ขายได้ ${part.onHand} · พักอยู่ ${part.held}`,
            en: `For sale ${part.onHand} · On hold ${part.held}`,
          })}
        </Text>
      </View>
    </View>
  );
}

/** No product has the scanned code — with the obvious next step one tap away. */
export function NotFoundCard({ code, onAdd }: { code: string; onAdd: () => void }) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <View style={[styles.card, styles.row, { backgroundColor: theme.surface }]}>
      <View style={[styles.icon, { backgroundColor: theme.hover }]}>
        <LineIcon d={SEARCH_ICON} color={theme.text} size={16} strokeWidth={2.2} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.headline, { color: theme.text }]}>
          {t({ th: "ไม่พบสินค้านี้ในร้าน", en: "No product has this code" })}
        </Text>
        <Text style={[styles.subhead, { color: theme.textMuted }]} selectable>
          {t({ th: `รหัส ${code}`, en: `Code ${code}` })}
        </Text>
        <Pressable onPress={onAdd} accessibilityRole="link" style={styles.link}>
          <Text style={[styles.subhead, { color: theme.primary }]}>
            {t({ th: "เพิ่มเป็นสินค้าใหม่", en: "Add as a new product" })}
          </Text>
        </Pressable>
      </View>
    </View>
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

/** The grey line under the camera before anything is scanned. */
export function Hint({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.hint, { color: theme.textMuted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, padding: SPACE.l, marginTop: SPACE.xl, gap: 2 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.m },
  text: { flex: 1, gap: 2 },
  footnote: { ...TYPE.footnote },
  code: { ...TYPE.title2, fontWeight: "600", letterSpacing: 0.5, fontVariant: ["tabular-nums"] },
  barcode: { marginTop: SPACE.m, alignItems: "center" },
  photo: { width: 56, height: 56, borderRadius: RADIUS.thumb },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
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
  hint: { ...TYPE.footnote, textAlign: "center", marginTop: 10, marginHorizontal: SPACE.xs },
});
