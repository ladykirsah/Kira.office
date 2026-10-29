import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { nextStep, type OrderListRow } from "@/lib/orderList";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { RADIUS, SPACE, TYPE } from "../theme";
import { ICON, STEP_ICON, toneColor } from "./icons";

interface OrderRowItemProps {
  order: OrderListRow;
  /** The grey time (or date) on the right. */
  when: string;
  first: boolean;
  last: boolean;
  onPress: () => void;
}

/**
 * One order in a grouped list, three lines (design guide): who, the order number, and what it is
 * waiting for — black with a coloured icon when the shop has a job, grey when it is only a status.
 */
export function OrderRowItem({ order, when, first, last, onPress }: OrderRowItemProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const step = nextStep(order.orderStatus, order.paymentStatus);
  const corners = {
    borderTopLeftRadius: first ? RADIUS.card : 0,
    borderTopRightRadius: first ? RADIUS.card : 0,
    borderBottomLeftRadius: last ? RADIUS.card : 0,
    borderBottomRightRadius: last ? RADIUS.card : 0,
  };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${order.buyerUsername ?? ""} ${order.externalOrderId} ${t(step.text)}`}
      style={({ pressed }) => [
        styles.row,
        corners,
        { backgroundColor: pressed ? theme.hover : theme.surface },
      ]}
    >
      {order.firstItemImageKey ? (
        <Image
          source={{ uri: `${API_BASE}/img/${order.firstItemImageKey}` }}
          style={[styles.photo, { backgroundColor: theme.bg }]}
        />
      ) : (
        <View style={[styles.photo, { backgroundColor: theme.hover }]} />
      )}
      <View
        style={[
          styles.body,
          !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        ]}
      >
        <View style={styles.lines}>
          {/* The time sits beside the name; no money in the row (owner, 29 Oct) — it is on the order's page. */}
          <View style={styles.top}>
            <Text style={[styles.who, { color: theme.text }]} numberOfLines={1}>
              {order.buyerUsername || "—"}
            </Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>{when}</Text>
          </View>
          <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
            {order.externalOrderId}
          </Text>
          <View style={styles.stepRow}>
            {step.icon && (
              <LineIcon
                d={STEP_ICON[step.icon]}
                color={toneColor(step.tone, theme)}
                size={16}
                strokeWidth={2}
              />
            )}
            <Text
              style={[styles.sub, { color: step.waiting ? theme.text : theme.textMuted }]}
              numberOfLines={1}
            >
              {t(step.text)}
            </Text>
          </View>
        </View>
        <View style={styles.chevron}>
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: SPACE.l },
  photo: { width: 56, height: 56, borderRadius: RADIUS.thumb },
  body: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.s,
    paddingVertical: SPACE.m,
    paddingRight: 14,
  },
  lines: { flex: 1, minWidth: 0, gap: 1 },
  top: { flexDirection: "row", alignItems: "baseline", gap: SPACE.s },
  who: { ...TYPE.headline, flex: 1, minWidth: 0 },
  sub: { ...TYPE.subhead },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  chevron: { marginTop: 4 },
});
