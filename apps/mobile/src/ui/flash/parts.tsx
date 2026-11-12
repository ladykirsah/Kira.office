import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import {
  STATE_TONE,
  clock,
  flashState,
  listLine,
  strip,
  type FlashSale,
  type FlashState,
} from "@/lib/flashPage";
import { useLang, useTheme } from "../AppProviders";
import { Dot } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Divider } from "../products/parts";
import { RADIUS, SPACE, TYPE } from "../theme";
import { CodeCopy } from "../CodeCopy";

/** The drawn icons (canvas v259): a picture for a product with no photo yet, and the red bin. */
export const PICTURE_ICON =
  "M5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11A2.5 2.5 0 0 1 5.5 4zM7.2 10a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0M21 16l-5-5-9 9";
export const TRASH_ICON =
  "M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6M18.5 6l-.8 13.1A2 2 0 0 1 15.7 21H8.3a2 2 0 0 1-2-1.9L5.5 6M10 10.5v6M14 10.5v6";

export const FLASH_BASE = "/settings/campaigns";

const MINUTE = 60_000;

/** The time now, moved on every minute, so the countdowns and สถานะ keep up. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** The state's dot: green on now, amber waiting, grey otherwise (the words beside it stay grey). */
export function StateDot({ state }: { state: FlashState }) {
  const { theme } = useTheme();
  const tone = STATE_TONE[state];
  return (
    <Dot
      color={tone === "good" ? theme.success : tone === "waiting" ? theme.waiting : theme.textMuted}
    />
  );
}

/** A product photo on its grey ground (a picture icon when it has none), its -% on the corner. */
export function OffPhoto(props: { imageKey: string | null; size: number; off?: string }) {
  const { theme } = useTheme();
  const box = { width: props.size, height: props.size, backgroundColor: theme.bg };
  return (
    <View style={[styles.photo, box]}>
      {props.imageKey ? (
        <Image source={{ uri: `${API_BASE}/img/${props.imageKey}` }} style={box} />
      ) : (
        <LineIcon d={PICTURE_ICON} color={theme.textFaint} size={22} strokeWidth={1.8} />
      )}
      {props.off ? (
        <View style={[styles.chip, { backgroundColor: theme.primary }]}>
          <Text style={[styles.chipText, { color: theme.onPrimary }]}>-{props.off}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One product of a sale: photo with its -%, name (regular, 2 lines), its code in grey, the sale price
 * with the normal one struck through, then a grey line (จำกัด / ขายแล้ว). On the form a tap opens
 * แก้ราคาลด and the bin takes it out.
 */
export function ItemRow(props: {
  name: string;
  /** The product's code, on its own grey line under the name. */
  code: string | null;
  /** A size on sale: its value, as a grey tag in front of its code (11 Nov 2026). */
  tag?: string | null;
  imageKey: string | null;
  off: string;
  price: string;
  base: string;
  sub: string;
  onPress?: () => void;
  onRemove?: () => void;
  last?: boolean;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const body = (
    <View style={styles.itemBody}>
      <OffPhoto imageKey={props.imageKey} size={52} off={props.off} />
      <View style={styles.grow}>
        <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={2}>
          {props.name}
        </Text>
        {props.code ? (
          <CodeCopy
            code={props.code}
            tag={props.tag}
            style={[TYPE.subhead, { color: theme.textMuted }]}
          />
        ) : null}
        <Text style={[TYPE.subhead, styles.nums, { color: theme.textMuted }]} numberOfLines={1}>
          <Text style={{ color: theme.text }}>{props.price}</Text>{" "}
          <Text style={styles.struck}>{props.base}</Text>
        </Text>
        <Text style={[TYPE.subhead, styles.nums, { color: theme.textMuted }]} numberOfLines={1}>
          {props.sub}
        </Text>
      </View>
    </View>
  );
  return (
    <View>
      {/* The row and its bin sit side by side: a press inside a press does not work on the web. */}
      <View style={[styles.item, !props.onRemove && styles.itemEnd]}>
        {props.onPress ? (
          <Pressable
            onPress={props.onPress}
            accessibilityRole="link"
            accessibilityLabel={props.name}
            style={styles.grow}
          >
            {body}
          </Pressable>
        ) : (
          <View style={styles.grow}>{body}</View>
        )}
        {props.onRemove && (
          <Pressable
            onPress={props.onRemove}
            accessibilityRole="button"
            accessibilityLabel={t({ th: `เอา ${props.name} ออก`, en: `Remove ${props.name}` })}
            style={styles.bin}
          >
            <LineIcon d={TRASH_ICON} color={theme.danger} size={22} strokeWidth={1.9} />
          </Pressable>
        )}
      </View>
      {!props.last && <Divider />}
    </View>
  );
}

/** จบใน / เริ่มใน over the grey boxes (hours and minutes, or days). */
function Clock({ sale, now }: { sale: FlashSale; now: number }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const c = clock(sale, now);
  if (!c) return null;
  return (
    <View style={styles.clock}>
      <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(c.side)}</Text>
      <View style={styles.tiles}>
        {c.tiles.map((tile) => (
          <View key={tile.unit.en} style={styles.tileCol}>
            <View style={[styles.tile, { backgroundColor: theme.bg }]}>
              <Text style={[styles.tileText, { color: theme.text }]}>{tile.value}</Text>
            </View>
            <Text style={[styles.unit, { color: theme.textMuted }]}>{t(tile.unit)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * One sale on a computer (DeskFlash board 1): one line — the name and its state, the photos with
 * their -% and what sold, the countdown (room kept for it when there is none), and ›.
 */
export function SaleRow(props: {
  sale: FlashSale;
  now: number;
  onPress: () => void;
  last?: boolean;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { sale, now } = props;
  const s = strip(sale, now);
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={sale.name}
      style={(state) => [
        styles.wideRow,
        !props.last && { borderBottomWidth: 1, borderBottomColor: theme.border },
        ((state as { hovered?: boolean }).hovered || state.pressed) && {
          backgroundColor: theme.sideOn,
        },
      ]}
    >
      <View style={styles.wideName}>
        <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={2}>
          {sale.name}
        </Text>
        <View style={styles.state}>
          <StateDot state={flashState(sale, now)} />
          <Text style={[TYPE.subhead, styles.grow, { color: theme.textMuted }]} numberOfLines={1}>
            {t(listLine(sale, now))}
          </Text>
        </View>
      </View>
      <View style={[styles.strip, styles.grow]}>
        {s.photos.map((p) => (
          <OffPhoto key={p.key} imageKey={p.imageKey} size={48} off={p.off} />
        ))}
        {s.more > 0 && (
          <View style={[styles.photo, styles.wideMore, { backgroundColor: theme.bg }]}>
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>+{s.more}</Text>
          </View>
        )}
        {s.sold && (
          <Text
            style={[TYPE.subhead, styles.wideSold, { color: theme.textMuted }]}
            numberOfLines={1}
          >
            {t(s.sold)}
          </Text>
        )}
      </View>
      <View style={styles.wideClock}>
        <Clock sale={sale} now={now} />
      </View>
      <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
    </Pressable>
  );
}

/** One sale in the list (B's countdown + C's photos): name, state, clock, ›; then photos and ขายแล้ว. */
export function SaleCard(props: {
  sale: FlashSale;
  now: number;
  onPress: () => void;
  last?: boolean;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { sale, now } = props;
  const s = strip(sale, now);
  return (
    <View>
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel={sale.name}
        style={({ pressed }) => [styles.card, pressed && { backgroundColor: theme.hover }]}
      >
        <View style={styles.cardTop}>
          <View style={styles.grow}>
            <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={1}>
              {sale.name}
            </Text>
            <View style={styles.state}>
              <StateDot state={flashState(sale, now)} />
              <Text
                style={[TYPE.subhead, styles.grow, { color: theme.textMuted }]}
                numberOfLines={1}
              >
                {t(listLine(sale, now))}
              </Text>
            </View>
          </View>
          <Clock sale={sale} now={now} />
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        </View>
        <View style={styles.strip}>
          {s.photos.map((p) => (
            <OffPhoto key={p.key} imageKey={p.imageKey} size={52} off={p.off} />
          ))}
          {s.more > 0 && (
            <View style={[styles.photo, styles.more, { backgroundColor: theme.bg }]}>
              <Text style={[TYPE.subhead, { color: theme.textMuted }]}>+{s.more}</Text>
            </View>
          )}
          {s.sold && (
            <Text style={[TYPE.subhead, styles.sold, { color: theme.textMuted }]} numberOfLines={1}>
              {t(s.sold)}
            </Text>
          )}
        </View>
      </Pressable>
      {!props.last && <Divider />}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  photo: {
    borderRadius: RADIUS.thumb,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    position: "absolute",
    left: 3,
    top: 3,
    height: 15,
    paddingHorizontal: 5,
    borderRadius: 7,
    justifyContent: "center",
  },
  chipText: { fontSize: 10, lineHeight: 15, fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", paddingLeft: SPACE.l },
  itemEnd: { paddingRight: SPACE.l },
  itemBody: { flexDirection: "row", alignItems: "center", gap: SPACE.m, paddingVertical: 10 },
  bin: {
    width: 44,
    height: 44,
    marginLeft: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  nums: { fontVariant: ["tabular-nums"] },
  struck: { textDecorationLine: "line-through" },
  card: { paddingVertical: SPACE.m, paddingHorizontal: SPACE.l, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: SPACE.m },
  state: { flexDirection: "row", alignItems: "center", gap: 6 },
  clock: { alignItems: "flex-end", gap: SPACE.xs },
  tiles: { flexDirection: "row", gap: SPACE.xs },
  tileCol: { alignItems: "center", gap: 2 },
  tile: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { fontSize: 20, lineHeight: 26, fontWeight: "600", fontVariant: ["tabular-nums"] },
  unit: { fontSize: 11, lineHeight: 14 },
  strip: { flexDirection: "row", alignItems: "center", gap: 6 },
  more: { width: 52, height: 52 },
  sold: { flex: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
  wideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xl,
    paddingVertical: 14,
    paddingHorizontal: SPACE.l,
    borderRadius: 10,
  },
  wideName: { width: 300, flexShrink: 0, gap: 2 },
  wideMore: { width: 48, height: 48 },
  wideSold: { marginLeft: SPACE.xs, fontVariant: ["tabular-nums"] },
  wideClock: { width: 100, alignItems: "flex-end" },
});
