import { Pressable, StyleSheet, Text, View } from "react-native";
import { changeText, movementLabel, type Movement } from "@/lib/stockHistory";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Photo } from "../products/parts";
import { SPACE, TYPE } from "../theme";

/**
 * One change, as picked (canvas v228): the product photo, its name on one line, its code in grey
 * (v354: "name · id · action and stock"), "ขายเด่นแอร์ · เหลือ 4" in grey, the change in a grey
 * badge, then ›. The line under it starts where the text starts.
 */
export function MovementRow(props: { m: Movement; last: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { m } = props;
  const type = t(movementLabel(m.movementType));
  const left = t({ th: `เหลือ ${m.quantityAfter}`, en: `${m.quantityAfter} left` });
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${m.productName}, ${type}, ${changeText(m.quantityDelta)}, ${left}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.hover }]}
    >
      <Photo imageKey={m.imageKey} size={44} />
      <View
        style={[
          styles.body,
          !props.last && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.text}>
          <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={1}>
            {m.productName}
          </Text>
          {m.productRef ? (
            <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
              {m.productRef}
            </Text>
          ) : null}
          <Text style={[TYPE.subhead, styles.nums, { color: theme.textMuted }]} numberOfLines={1}>
            {type} · {left}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: theme.bg }]}>
          <Text style={[TYPE.body, styles.nums, { color: theme.text }]}>
            {changeText(m.quantityDelta)}
          </Text>
        </View>
        <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.m, paddingLeft: SPACE.l },
  body: {
    flex: 1,
    minWidth: 0,
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
    paddingVertical: 10,
    paddingRight: SPACE.l,
  },
  text: { flex: 1, minWidth: 0 },
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
