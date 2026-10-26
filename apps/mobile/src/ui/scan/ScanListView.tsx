import type { Phrase } from "@l-shopee/shared/lang";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { partLine, partProblem, type HoldWay, type ScannedPart } from "@/lib/scanList";
import { useLang, useTheme } from "../AppProviders";
import { RADIUS, SPACE, TYPE } from "../theme";
import { PartRow } from "./PartRow";
import type { ListMode } from "./useScanSession";

const TITLES: Record<ListMode, Phrase> = {
  hold: { th: "เอาไปพัก", en: "To put on hold" },
  fill: { th: "รับเข้า", en: "Receiving" },
  sell: { th: "ในบิล", en: "In the bill" },
};
const BRING_BACK_TITLE: Phrase = { th: "นำกลับเข้าร้าน", en: "To bring back" };

const FOOTNOTES: Record<ListMode, Phrase> = {
  hold: {
    th: "ของที่พักไว้จะไม่ขายบน AirPlus และหน้าร้าน จนกว่าจะนำกลับ",
    en: "Stock on hold is not sold on AirPlus or at the counter until it is brought back.",
  },
  fill: {
    th: "แตะตัวเลขเพื่อแก้จำนวน · ปัดซ้ายเพื่อนำออก",
    en: "Tap the number to change it · swipe left to remove",
  },
  sell: {
    th: "กดแล้วเปิดหน้าทำบิลในระบบเดิม ของอยู่ในตะกร้าแล้ว รอรับเงิน",
    en: "Opens ทำบิล in the current back office with these in the cart, ready to take payment.",
  },
};

interface ScanListViewProps {
  mode: ListMode;
  way: HoldWay;
  list: readonly ScannedPart[];
  refused: Record<string, string>;
  onQty: (variantId: string) => void;
  onRemove: (variantId: string) => void;
  onClear: () => void;
}

/** The scanned parts as one rounded card, with what each will change shown before saving. */
export function ScanListView(props: ScanListViewProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { mode, way, list, refused } = props;
  const title = mode === "hold" && way === "bringBack" ? BRING_BACK_TITLE : TITLES[mode];
  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          {t(title)}
        </Text>
        <Text style={[styles.count, { color: theme.textMuted }]}>
          {t({ th: `${list.length} รายการ`, en: `${list.length} items` })}
        </Text>
        <Pressable onPress={props.onClear} accessibilityRole="button" hitSlop={10}>
          <Text style={[styles.clear, { color: theme.primary }]}>
            {t({ th: "ล้าง", en: "Clear" })}
          </Text>
        </Pressable>
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        {list.map((part, i) => {
          const refusal = refused[part.variantId];
          const problem = partProblem(part, mode, way);
          return (
            <PartRow
              key={part.variantId}
              part={part}
              imageUrl={part.imageKey ? `${API_BASE}/img/${part.imageKey}` : null}
              line={refusal ?? t(problem ?? partLine(part, mode, way))}
              tone={refusal ? "refused" : problem ? "problem" : "plain"}
              last={i === list.length - 1}
              onQty={() => props.onQty(part.variantId)}
              onRemove={() => props.onRemove(part.variantId)}
            />
          );
        })}
      </View>
      <Text style={[styles.footnote, { color: theme.textMuted }]}>{t(FOOTNOTES[mode])}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: SPACE.s,
    marginTop: SPACE.xl,
    marginBottom: SPACE.m,
    marginHorizontal: 2,
  },
  title: { ...TYPE.title2 },
  count: { ...TYPE.subhead, flex: 1 },
  clear: { ...TYPE.body },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  footnote: { ...TYPE.footnote, marginTop: 10, marginHorizontal: SPACE.xs },
});
