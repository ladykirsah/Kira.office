import type { Phrase } from "@l-shopee/shared/lang";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ShopeeWorkItem } from "@/lib/homeApi";
import {
  HOME_TILES,
  doneLine,
  ordersTabRoute,
  shopeeChange,
  showsInsightButton,
  todayLine,
} from "@/lib/homePage";
import type { OrderTab } from "@/lib/orderList";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { Group } from "../orders/parts";
import { ICON, STEP_ICON } from "../orders/icons";
import { Divider } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SectionHeading } from "../SectionHeading";
import { CopyIcon } from "../staff/parts";
import { RADIUS, SPACE, TYPE, type Theme } from "../theme";
import { useHome } from "./useHome";

const TOAST_MS = 3500;
const CHART = "M3 3v18h18M7 15l4-4 3 3 6-6";
const TILE_ICON: Record<OrderTab, string> = {
  unpaid: ICON.pending,
  pending: ICON.pending,
  toship: ICON.box,
  shipped: ICON.truck,
  completed: ICON.check,
  cancelfail: ICON.ban,
  refundclaim: STEP_ICON.back,
};

/** Amber for a payment decision, blue for parcels to pack, grey for the rest (canvas v331). */
const tileColour = (tab: OrderTab, theme: Theme) =>
  tab === "pending" ? theme.waiting : tab === "toship" ? theme.toShip : theme.textMuted;

/**
 * หน้าหลัก (canvas v331, owner OK 4 Nov 2026): what's waiting — the four Orders tabs that need
 * someone, and the products whose stock Shopee still needs to hear about. Sign-in lands here.
 */
export function HomeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { t } = useLang();
  const { theme } = useTheme();
  const token = auth.status === "signed-in" ? auth.token : null;
  const role = auth.status === "signed-in" ? auth.staff.role : "mechanic";
  const home = useHome(token);
  const [toast, setToast] = useState<Phrase | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const showToast = (said: Phrase) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(said);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  useScreenChrome(
    null,
    showsInsightButton(role)
      ? [
          {
            label: t({ th: "ดูภาพรวม AirPlus", en: "AirPlus overview" }),
            kind: "dark",
            icon: CHART,
            onPress: () => router.push("/insights" as never),
          },
        ]
      : [],
    { toast: toast && { title: t(toast), detail: "" } },
  );

  return (
    <View>
      <Text style={[TYPE.subhead, styles.date, { color: theme.textMuted }]}>
        {t(todayLine(Date.now()))}
      </Text>

      {home.offline && <Offline />}

      <SectionHeading
        title={t({ th: "ต้องจัดการ", en: "To do" })}
        more={{
          label: t({ th: "ดูออเดอร์", en: "See orders" }),
          onPress: () => router.push("/orders" as never),
        }}
      />
      <View style={styles.tiles}>
        {HOME_TILES.map((tile) => (
          <Tile
            key={tile.tab}
            label={t(tile.label)}
            count={home.counts?.[tile.tab] ?? null}
            icon={TILE_ICON[tile.tab]}
            colour={tileColour(tile.tab, theme)}
            onPress={() => router.push(ordersTabRoute(tile.tab) as never)}
          />
        ))}
      </View>

      {home.items && (
        <>
          <SectionHeading title={t({ th: "อัปเดตใน Shopee", en: "Update on Shopee" })} />
          {home.items.length === 0 ? (
            <NothingWaiting />
          ) : (
            <ShopeeList
              items={home.items}
              ticked={home.ticked}
              onToggle={home.toggle}
              onClear={home.clearDone}
              onCopied={showToast}
            />
          )}
        </>
      )}
    </View>
  );
}

function Tile(props: {
  label: string;
  count: number | null;
  icon: string;
  colour: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const idle = props.count == null || props.count === 0;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${props.label} ${props.count ?? "—"}`}
      style={[styles.tile, { backgroundColor: theme.surface }]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.dot, { backgroundColor: idle ? theme.textFaint : props.colour }]}>
          <LineIcon d={props.icon} color="#FFFFFF" size={16} strokeWidth={2.4} />
        </View>
        <Text style={[styles.count, { color: idle ? theme.textFaint : theme.text }]}>
          {props.count ?? "—"}
        </Text>
      </View>
      <Text style={[TYPE.subhead, { color: theme.text }]} numberOfLines={1}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function ShopeeList(props: {
  items: readonly ShopeeWorkItem[];
  ticked: readonly string[];
  onToggle: (productId: string) => void;
  onClear: () => void;
  onCopied: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const done = props.ticked.length;
  return (
    <>
      <Group>
        {props.items.map((item, i) => {
          const on = props.ticked.includes(item.productId);
          return (
            <View key={item.productId}>
              <View style={styles.row}>
                <View style={styles.grow}>
                  <Text style={[TYPE.body, { color: theme.text }]}>{item.name}</Text>
                  <View style={styles.codeLine}>
                    <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                      {item.productRef}
                    </Text>
                    <CopyIcon
                      value={item.productRef}
                      what={{ th: ` ${item.productRef} `, en: item.productRef }}
                      onCopied={props.onCopied}
                    />
                    <Text style={[TYPE.subhead, styles.grow, { color: theme.textMuted }]}>
                      · {t(shopeeChange(item.deltaSinceSync))}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => props.onToggle(item.productId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t({ th: `ทำแล้ว ${item.name}`, en: `Done: ${item.name}` })}
                  hitSlop={10}
                  style={[
                    styles.tick,
                    on
                      ? { backgroundColor: theme.primary }
                      : { borderWidth: 1.5, borderColor: theme.textFaint },
                  ]}
                >
                  {on && <LineIcon d={ICON.check} color="#FFFFFF" size={14} strokeWidth={3} />}
                </Pressable>
              </View>
              {i < props.items.length - 1 && <Divider />}
            </View>
          );
        })}
      </Group>
      {done > 0 && (
        <View style={styles.doneRow}>
          <Text style={[TYPE.footnote, styles.grow, { color: theme.textMuted }]}>
            {t(doneLine(done, props.items.length))}
          </Text>
          <Pressable onPress={props.onClear} accessibilityRole="button" hitSlop={10}>
            <Text style={[TYPE.footnote, { color: theme.primary }]}>
              {t({ th: "ล้างที่ทำแล้ว", en: "Clear done" })}
            </Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

function NothingWaiting() {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <Group>
      <View style={styles.note}>
        <View style={[styles.dot, { backgroundColor: theme.success }]}>
          <LineIcon d={ICON.check} color="#FFFFFF" size={15} strokeWidth={2.8} />
        </View>
        <View style={styles.grow}>
          <Text style={[TYPE.body, { color: theme.text }]}>
            {t({ th: "ไม่มีรายการต้องอัปเดต", en: "Nothing to update" })}
          </Text>
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
            {t({
              th: "สต็อกใน Shopee ตรงกับในร้านแล้ว",
              en: "Shopee's stock matches the shop's",
            })}
          </Text>
        </View>
      </View>
    </Group>
  );
}

function Offline() {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View style={styles.offline}>
      <Group>
        <View style={[styles.note, styles.top]} accessibilityRole="alert">
          <View style={[styles.bang, { backgroundColor: theme.danger }]}>
            <Text style={styles.bangText}>!</Text>
          </View>
          <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>
            {t({
              th: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่",
              en: "Can't reach the server. Check the connection and try again.",
            })}
          </Text>
        </View>
      </Group>
    </View>
  );
}

const styles = StyleSheet.create({
  date: { marginTop: -SPACE.s, paddingHorizontal: 2 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.s },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    height: 84,
    borderRadius: RADIUS.card,
    paddingVertical: SPACE.m,
    paddingHorizontal: 14,
    justifyContent: "space-between",
  },
  tileTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  count: { fontSize: 28, lineHeight: 31, fontVariant: ["tabular-nums"] },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingVertical: 10,
    paddingHorizontal: SPACE.l,
  },
  grow: { flex: 1, minWidth: 0 },
  codeLine: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  tick: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACE.s,
    marginHorizontal: SPACE.l,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingVertical: 14,
    paddingHorizontal: SPACE.l,
  },
  top: { alignItems: "flex-start" },
  offline: { marginTop: SPACE.l },
  bang: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  bangText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
