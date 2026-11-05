import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  STATE_TONE,
  bigValue,
  capLine,
  couponState,
  footLine,
  forLine,
  kindLine,
  stateLine,
  type Coupon,
  type CouponState,
} from "@/lib/couponPage";
import { useLang, useTheme } from "../AppProviders";
import { Dot } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { TYPE } from "../theme";

/** In front of the value, as drawn: a price tag, or a truck for a coupon on the shipping fee. */
const TAG =
  "M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4zM7.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3";
const TRUCK =
  "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4";

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

/**
 * Card C, as the owner picked it (canvas v266): what it takes money off (and on the list, how it
 * stands), the icon and big value with its cap, the short สำหรับ… rule and a hairline. Under it goes
 * the list's grey line and code, or the coupon page's big code to copy.
 */
export function CouponFace(props: {
  coupon: Coupon;
  radius: number;
  padding: number;
  /** The list says how it stands at the top right; the page has a สถานะ row instead. */
  now?: number;
  /** Fill the height it is given (a computer's row of tickets, all the same height). */
  fill?: boolean;
  children: ReactNode;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const c = props.coupon;
  const cap = capLine(c);
  return (
    <View
      style={[
        styles.face,
        {
          backgroundColor: theme.surface,
          borderWidth: theme.cardLine,
          borderColor: theme.border,
          borderRadius: props.radius,
          paddingHorizontal: 16,
          paddingVertical: props.padding,
        },
        props.fill && styles.fill,
      ]}
    >
      <View style={styles.row}>
        <Text style={[TYPE.footnote, styles.grow, { color: theme.textMuted }]} numberOfLines={1}>
          {t(kindLine(c))}
        </Text>
        {props.now != null && (
          <>
            <StateDot state={couponState(c, props.now)} />
            <Text style={[TYPE.footnote, { color: theme.textMuted }]} numberOfLines={1}>
              {t(stateLine(c, props.now))}
            </Text>
          </>
        )}
      </View>
      <View style={styles.value}>
        <LineIcon
          d={c.appliesTo === "shipping" ? TRUCK : TAG}
          color={theme.primary}
          size={30}
          strokeWidth={2}
        />
        <Text style={[styles.big, { color: theme.text }]} numberOfLines={1}>
          {bigValue(c)}
        </Text>
        {cap && (
          <Text style={[TYPE.subhead, styles.grow, { color: theme.textMuted }]} numberOfLines={1}>
            {t(cap)}
          </Text>
        )}
      </View>
      <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={2}>
        {t(forLine(c))}
      </Text>
      <View style={[styles.hairline, { backgroundColor: theme.border }]} />
      {props.children}
    </View>
  );
}

/** One coupon in the list: card C, then the grey line, the code and ›. */
export function CouponCard(props: { coupon: Coupon; onPress: () => void; fill?: boolean }) {
  const { coupon } = props;
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={coupon.name ?? coupon.code}
      style={({ pressed }) => [props.fill && styles.fill, pressed && styles.pressed]}
    >
      <CouponFace coupon={coupon} radius={16} padding={14} now={Date.now()} fill={props.fill}>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
          {t(footLine(coupon))}
        </Text>
        <View style={[styles.row, styles.codeRow]}>
          <Text style={[TYPE.subhead, styles.code, styles.grow, { color: theme.text }]}>
            {coupon.code}
          </Text>
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        </View>
      </CouponFace>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  value: { flexDirection: "row", alignItems: "center", gap: 10 },
  big: { fontSize: 34, lineHeight: 41, fontWeight: "700", fontVariant: ["tabular-nums"] },
  hairline: { height: 1, marginVertical: 4 },
  codeRow: { marginTop: 2 },
  code: { fontWeight: "700", letterSpacing: 0.5 },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
  fill: { flex: 1 },
});
