import type { Phrase } from "@l-shopee/shared/lang";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { rowState, rowSub, type AffiliateItem } from "@/lib/affiliatePage";
import { API_BASE } from "@/lib/config";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { SmallButton } from "../orders/parts";
import { RADIUS, SPACE, TYPE } from "../theme";

/** The drawn icons (canvas v238): a pushpin for หน้าแรก, a wrench on a card with no photo yet. */
export const PIN_ICON = "M9 4h6l-1 6 3 3H7l3-3zM12 13v7";
export const WRENCH_ICON =
  "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z";
export const CAMERA_ICON = "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8";

/** A message the form or the card page leaves for the list it goes back to (shown once). */
let waiting: { title: Phrase; detail: Phrase } | null = null;

export function leaveToast(toast: { title: Phrase; detail: Phrase } | null): void {
  waiting = toast;
}

export function takeToast(): { title: Phrase; detail: Phrase } | null {
  const toast = waiting;
  waiting = null;
  return toast;
}

/** The card's photo on its grey ground; the wrench when it has none yet. */
export function CardPhoto(props: {
  imageKey: string | null;
  uri?: string;
  size?: number;
  height?: number;
  radius?: number;
}) {
  const { theme } = useTheme();
  const box = {
    width: props.size ?? "100%",
    height: props.height ?? props.size ?? 240,
    borderRadius: props.radius ?? RADIUS.thumb,
    backgroundColor: theme.hover,
  } as const;
  const uri = props.uri ?? (props.imageKey ? `${API_BASE}/img/${props.imageKey}` : null);
  if (uri) return <Image source={{ uri }} style={box} resizeMode="cover" />;
  // A 44 wrench on the full-width photo (as drawn); a smaller one on a thumbnail.
  const icon = props.size ? Math.round(props.size * 0.45) : 44;
  return (
    <View style={[box, styles.center]}>
      <LineIcon d={WRENCH_ICON} color={theme.textMuted} size={icon} strokeWidth={1.8} />
    </View>
  );
}

/**
 * One card in a list: photo, name, "Shopee · ฿1,290", then "คลิก 124 · หน้าแรก" (or ปิดอยู่), and a ›
 * — or, on ยังไม่จัดหมวด, a เลือกหมวด button in its place.
 */
export function ItemRow(props: {
  item: AffiliateItem;
  last: boolean;
  onPress?: () => void;
  action?: ReactNode;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const state = rowState(props.item);
  const clicks =
    state.kind === "on" ? t({ th: `คลิก ${state.clicks}`, en: `${state.clicks} clicks` }) : "";
  const body = (
    <>
      <CardPhoto imageKey={props.item.imageKey} size={56} />
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
            {props.item.title}
          </Text>
          <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
            {t(rowSub(props.item))}
          </Text>
          {state.kind === "off" ? (
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
              {t({ th: "ปิดอยู่", en: "Off" })}
            </Text>
          ) : (
            <View style={styles.state}>
              <Text style={[TYPE.subhead, styles.nums, { color: theme.textMuted }]}>{clicks}</Text>
              {state.home && (
                <>
                  <Text style={[TYPE.subhead, { color: theme.textMuted }]}> · </Text>
                  <LineIcon d={PIN_ICON} color={theme.textMuted} size={13} strokeWidth={2} />
                  <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                    {t({ th: " หน้าแรก", en: " Home" })}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
        {props.action ??
          (props.onPress ? (
            <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
          ) : null)}
      </View>
    </>
  );
  if (!props.onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.hover }]}
    >
      {body}
    </Pressable>
  );
}

/**
 * A row of the card's facts, drawn like the form's rows (label 96 wide, the value after it), so the
 * card page and แก้ไข read the same; a › and a tap when it opens something (the link).
 */
export function ValueRow(props: {
  label: string;
  value: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const body = (
    <View style={styles.valueRow}>
      <Text style={[TYPE.subhead, styles.label, { color: theme.text }]}>{props.label}</Text>
      <Text style={[TYPE.body, styles.value, { color: theme.text }]} numberOfLines={1}>
        {props.value}
      </Text>
      {props.onPress && (
        <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
      )}
    </View>
  );
  return (
    <View>
      {props.onPress ? (
        <Pressable onPress={props.onPress} accessibilityRole="link">
          {body}
        </Pressable>
      ) : (
        body
      )}
      {!props.last && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
    </View>
  );
}

/** The list did not load: say so, and offer ลองอีกครั้ง. */
export function Retry({ onPress }: { onPress: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View style={styles.retry}>
      <Text style={[TYPE.subhead, styles.text, { color: theme.text }]}>
        {t({ th: "โหลดรายการไม่ได้", en: "The list did not load" })}
      </Text>
      <SmallButton label={t({ th: "ลองอีกครั้ง", en: "Try again" })} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  retry: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.m },
  center: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.m, paddingLeft: SPACE.l },
  body: {
    flex: 1,
    minWidth: 0,
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
    paddingVertical: 10,
    paddingRight: SPACE.l,
  },
  text: { flex: 1, minWidth: 0 },
  state: { flexDirection: "row", alignItems: "center" },
  nums: { fontVariant: ["tabular-nums"] },
  valueRow: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: { width: 96 },
  value: { flex: 1, minWidth: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: SPACE.l },
});
