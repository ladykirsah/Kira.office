import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  FULL_TOAST,
  STATE_TONE,
  addTitle,
  bannerState,
  linkLine,
  rowName,
  segmentLabel,
  slotFull,
  slotRows,
  statusLine,
  type Banner,
  type BannerSlot,
} from "@/lib/bannerPage";
import { useLang, useTheme } from "../AppProviders";
import { Dot } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { Retry } from "../affiliate/parts";
import { ICON } from "../orders/icons";
import { useScreenChrome } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { RADIUS, SPACE, TYPE } from "../theme";
import { BannerPicture, MoveButton } from "./parts";
import { useBannerList } from "./useBannerList";

const BASE = "/settings/banners";
const SLOTS: readonly BannerSlot[] = ["hero", "promo"];

/**
 * แบนเนอร์ (canvas v245, แบนเนอร์ 1): สไลด์หลัก (3 places) and แถบโปรโมชัน, each banner with its real
 * picture, its state and dates, its link, and ▲ ▼ to change the order. ＋ adds to the slot showing;
 * a full สไลด์หลัก says so instead.
 */
export function BannerListScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ slot?: string }>();
  // The tab lives in the address, so coming back from a banner's page opens the same tab.
  const slot: BannerSlot = params.slot === "promo" ? "promo" : "hero";
  const list = useBannerList();
  const rows = list.banners ? slotRows(list.banners, slot) : [];
  const full = slotFull(slot, rows.length);

  const add = () => {
    if (full) return list.showToast(FULL_TOAST);
    router.push(`${BASE}/new?slot=${slot}` as never);
  };

  useScreenChrome({ label: t(addTitle(slot)), icon: ICON.plus, onPress: add }, [], {
    toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null,
  });

  if (!list.banners) {
    return list.failed ? (
      <Retry onPress={() => void list.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  const counts = (s: BannerSlot) => slotRows(list.banners!, s).length;
  // A strip list shows its add tile only while empty; สไลด์หลัก while it has room (as drawn).
  const showTile = slot === "promo" ? rows.length === 0 : !full;
  return (
    <View>
      {list.failed && <Retry onPress={() => void list.load()} />}
      <View style={styles.seg}>
        <Segmented
          label={t({ th: "ที่แสดงแบนเนอร์", en: "Where the banner shows" })}
          options={SLOTS.map((s) => ({ value: s, label: t(segmentLabel(s, counts(s))) }))}
          value={slot}
          onChange={(next) => router.setParams({ slot: next })}
        />
      </View>
      <View style={styles.list}>
        {rows.map((b, i) => (
          <BannerCard
            key={b.id}
            banner={b}
            name={t(rowName(slot, i))}
            first={i === 0}
            last={i === rows.length - 1}
            onOpen={() => router.push(`${BASE}/${encodeURIComponent(b.id)}` as never)}
            onMove={(step) => list.move(slot, i, step)}
          />
        ))}
        {showTile && (
          <Pressable
            onPress={add}
            accessibilityRole="button"
            style={[styles.tile, { borderColor: theme.textFaint }]}
          >
            <LineIcon d={ICON.plus} color={theme.primary} size={22} strokeWidth={2.2} />
            <Text style={[styles.tileText, { color: theme.primary }]}>
              {t(
                slot === "hero"
                  ? { th: "เพิ่มสไลด์", en: "Add a slide" }
                  : { th: "เพิ่มแถบโปรโมชัน", en: "Add a promo strip" },
              )}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function BannerCard(props: {
  banner: Banner;
  name: string;
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onMove: (step: -1 | 1) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const now = Date.now();
  const tone = STATE_TONE[bannerState(props.banner, now)];
  // The picture and the words open the banner; ▲ ▼ sit beside them (a button inside a button is
  // not allowed on the web).
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Pressable onPress={props.onOpen} accessibilityRole="button" accessibilityLabel={props.name}>
        <BannerPicture imageKey={props.banner.imageKey} />
      </Pressable>
      <View style={styles.info}>
        <Pressable onPress={props.onOpen} style={styles.text}>
          <Text style={[TYPE.headline, { color: theme.text }]}>{props.name}</Text>
          <View style={styles.state}>
            <Dot
              color={
                tone === "success"
                  ? theme.success
                  : tone === "waiting"
                    ? theme.waiting
                    : theme.textMuted
              }
            />
            <Text style={[TYPE.subhead, styles.grow, { color: theme.textMuted }]} numberOfLines={1}>
              {t(statusLine(props.banner, now))}
            </Text>
          </View>
          <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
            {t(linkLine(props.banner))}
          </Text>
        </Pressable>
        <View style={styles.moves}>
          <MoveButton
            up
            enabled={!props.first}
            label={t({ th: "เลื่อนขึ้น", en: "Move up" })}
            onPress={() => props.onMove(-1)}
          />
          <MoveButton
            up={false}
            enabled={!props.last}
            label={t({ th: "เลื่อนลง", en: "Move down" })}
            onPress={() => props.onMove(1)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { marginTop: SPACE.l },
  list: { marginTop: SPACE.m, gap: 10 },
  card: { borderRadius: RADIUS.card, padding: SPACE.m, gap: 10 },
  info: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: SPACE.xs },
  text: { flex: 1, minWidth: 0 },
  state: { flexDirection: "row", alignItems: "center", gap: 6 },
  grow: { flex: 1, minWidth: 0 },
  moves: { flexDirection: "row", gap: SPACE.s },
  tile: {
    height: 125,
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
  },
  tileText: { fontSize: 15 },
});
