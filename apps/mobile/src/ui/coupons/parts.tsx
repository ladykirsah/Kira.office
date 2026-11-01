import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  STATE_TONE,
  bigValue,
  cardLine,
  conditionLine,
  couponState,
  type Coupon,
  type CouponState,
} from "@/lib/couponPage";
import { useLang, useTheme } from "../AppProviders";
import { Dot } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { TYPE } from "../theme";

const NOTCH = 18;
/** Enough dashes for the tallest ticket; the column hides what does not fit. */
const DASHES = Array.from({ length: 24 }, (_, i) => i);

/**
 * The ticket the owner picked (card B, canvas v252): a red-tinted stub with the big value and ส่วนลด,
 * a dashed tear line with a notch above and below, then the rest on white. The list's card and the
 * coupon page's big ticket are the same shape at two sizes.
 */
export function Ticket(props: {
  big: string;
  stub: number;
  bigSize: number;
  radius: number;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const notch = { left: props.stub - NOTCH / 2, backgroundColor: theme.bg };
  return (
    <View style={[styles.ticket, { backgroundColor: theme.surface, borderRadius: props.radius }]}>
      <View
        style={[
          styles.stub,
          {
            width: props.stub,
            backgroundColor: theme.primarySoft,
            borderTopLeftRadius: props.radius,
            borderBottomLeftRadius: props.radius,
          },
        ]}
      >
        <Text
          style={[
            styles.big,
            { color: theme.primary, fontSize: props.bigSize, lineHeight: props.bigSize * 1.2 },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {props.big}
        </Text>
        <Text style={[TYPE.footnote, { color: theme.primary }]}>
          {t({ th: "ส่วนลด", en: "Off" })}
        </Text>
      </View>
      <View style={[styles.tear, { left: props.stub }]}>
        {DASHES.map((i) => (
          <View key={i} style={[styles.dash, { backgroundColor: theme.primary }]} />
        ))}
      </View>
      <View style={[styles.notch, styles.top, notch]} />
      <View style={[styles.notch, styles.bottom, notch]} />
      {props.children}
    </View>
  );
}

/** The state's dot: green in use, amber waiting to start, grey otherwise (the words stay grey). */
export function StateDot({ state }: { state: CouponState }) {
  const { theme } = useTheme();
  const tone = STATE_TONE[state];
  return (
    <Dot
      color={
        tone === "success" ? theme.success : tone === "waiting" ? theme.waiting : theme.textMuted
      }
    />
  );
}

/** One coupon in the list: name, code · its condition, the state's dot and words, ›. */
export function CouponCard({ coupon, onPress }: { coupon: Coupon; onPress: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const now = Date.now();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={coupon.name ?? coupon.code}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Ticket big={bigValue(coupon)} stub={84} bigSize={22} radius={16}>
        <View style={styles.cardBody}>
          <View style={styles.text}>
            <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={1}>
              {coupon.name || coupon.code}
            </Text>
            <Text style={[TYPE.subhead, { color: theme.text }]} numberOfLines={1}>
              <Text style={styles.code}>{coupon.code}</Text>
              <Text style={{ color: theme.textMuted }}> · {t(conditionLine(coupon))}</Text>
            </Text>
            <View style={styles.state}>
              <StateDot state={couponState(coupon, now)} />
              <Text
                style={[TYPE.subhead, styles.grow, { color: theme.textMuted }]}
                numberOfLines={1}
              >
                {t(cardLine(coupon, now))}
              </Text>
            </View>
          </View>
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        </View>
      </Ticket>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ticket: { flexDirection: "row" },
  stub: { alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 6 },
  big: { fontWeight: "800", fontVariant: ["tabular-nums"] },
  // Laid over the stub's edge so the dashes follow the ticket's height instead of setting it.
  tear: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1.5,
    overflow: "hidden",
    gap: 4,
    opacity: 0.25,
  },
  dash: { width: 1.5, height: 5 },
  notch: { position: "absolute", width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
  top: { top: -NOTCH / 2 },
  bottom: { bottom: -NOTCH / 2 },
  cardBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  code: { fontWeight: "700", letterSpacing: 0.5 },
  state: { flexDirection: "row", alignItems: "center", gap: 6 },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
});
