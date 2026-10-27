import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { API_BASE } from "@/lib/config";
import { priceTag } from "@/lib/scanSale";
import type { ScannedPart } from "@/lib/scanTabs";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { RADIUS, SPACE, TYPE } from "../theme";

const PHOTO = 96;
const PHOTO_GAP = 8;
const CHEVRON = "M9 5l7 7-7 7";

interface ProductCardProps {
  part: ScannedPart;
  /** What the number means on this tab (จำนวนที่ขาย, อยู่งานนอก, พร้อมขาย). */
  label: string;
  /** The grey line: the stock as it is now, or why the shop's system refused the last save. */
  sub: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  /** Tap the photos or the name to open the product's page. */
  onOpen: () => void;
}

/**
 * Scan v2's one product card, the same on every tab (owner approved, 2026-10-26): photos to swipe,
 * the name, the walk-in price with the mechanic price in brackets, and the − n + row that means
 * what the tab is about.
 */
export function ProductCard(props: ProductCardProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { part } = props;
  const [page, setPage] = useState(0);
  const tag = priceTag(part);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / (PHOTO + PHOTO_GAP)));
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.photos}
        accessibilityLabel={t({ th: "รูปสินค้า ปัดเพื่อดูรูปถัดไป", en: "Photos, swipe for more" })}
      >
        {part.photoKeys.length === 0 ? (
          <View style={[styles.photo, { backgroundColor: theme.hover }]} />
        ) : (
          part.photoKeys.map((key) => (
            <Pressable key={key} onPress={props.onOpen} accessibilityRole="imagebutton">
              <Image
                source={{ uri: `${API_BASE}/img/${key}` }}
                style={[styles.photo, { backgroundColor: theme.bg }]}
              />
            </Pressable>
          ))
        )}
      </ScrollView>
      {part.photoKeys.length > 1 && (
        <View style={styles.dots} aria-hidden>
          {part.photoKeys.map((key, i) => (
            <View
              key={key}
              style={[styles.dot, { backgroundColor: i === page ? theme.text : theme.textFaint }]}
            />
          ))}
        </View>
      )}
      <Pressable
        onPress={props.onOpen}
        accessibilityRole="link"
        accessibilityLabel={t({ th: `เปิดหน้าสินค้า ${part.name}`, en: `Open ${part.name}` })}
        style={styles.nameRow}
      >
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {part.name}
        </Text>
        <LineIcon d={CHEVRON} color={theme.textFaint} size={15} strokeWidth={2.4} />
      </Pressable>
      <Text
        style={[styles.price, { color: theme.text }]}
        accessibilityLabel={t({
          th: `ราคาลูกค้า ${tag.price} ราคาช่าง ${tag.mechanic}`,
          en: `Walk-in ${tag.price}, mechanic ${tag.mechanic}`,
        })}
      >
        {tag.price} <Text style={{ color: theme.textMuted }}>{tag.mechanic}</Text>
      </Text>
      <View style={[styles.stockRow, { borderTopColor: theme.border }]}>
        <View style={styles.stockText}>
          <Text style={[styles.label, { color: theme.text }]}>{props.label}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{props.sub}</Text>
        </View>
        <View style={styles.stepper} accessibilityLabel={props.label}>
          <StepButton
            sign="−"
            label={t({ th: "ลด", en: "Less" })}
            onPress={props.onMinus}
            color={theme.text}
          />
          <View style={[styles.value, { backgroundColor: theme.hover }]}>
            <Text style={[styles.valueText, { color: theme.text }]}>{props.value}</Text>
          </View>
          <StepButton
            sign="+"
            label={t({ th: "เพิ่ม", en: "More" })}
            onPress={props.onPlus}
            color={theme.text}
          />
        </View>
      </View>
    </View>
  );
}

function StepButton(props: { sign: string; label: string; onPress: () => void; color: string }) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      hitSlop={6}
      style={styles.stepButton}
    >
      <Text style={[styles.stepSign, { color: props.color }]}>{props.sign}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: SPACE.m, borderRadius: RADIUS.card, overflow: "hidden" },
  photos: { gap: PHOTO_GAP, paddingTop: SPACE.l, paddingHorizontal: SPACE.l },
  photo: { width: PHOTO, height: PHOTO, borderRadius: 14 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: SPACE.s },
  dot: { width: 6, height: 6, borderRadius: 3 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACE.s,
    marginHorizontal: SPACE.l,
  },
  name: { ...TYPE.headline, flex: 1 },
  price: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    marginHorizontal: SPACE.l,
    fontVariant: ["tabular-nums"],
  },
  stockRow: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    marginTop: SPACE.m,
    marginLeft: SPACE.l,
    paddingRight: SPACE.l,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stockText: { flex: 1, minWidth: 0 },
  label: { ...TYPE.body },
  sub: { ...TYPE.subhead, fontVariant: ["tabular-nums"] },
  stepper: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  stepButton: { width: 34, height: 36, alignItems: "center", justifyContent: "center" },
  stepSign: { fontSize: 24, lineHeight: 28 },
  value: {
    minWidth: 72,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.m,
  },
  valueText: { ...TYPE.body, fontVariant: ["tabular-nums"] },
});
