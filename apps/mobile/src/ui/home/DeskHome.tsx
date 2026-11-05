import type { Phrase } from "@l-shopee/shared/lang";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import type { ShopeeWorkItem } from "@/lib/homeApi";
import { HOME_TILES, doneLine, ordersTabRoute, shopeeChange } from "@/lib/homePage";
import { billCountLine, quickLinks } from "@/lib/homeToday";
import { money } from "@/lib/financePage";
import type { OrderTab } from "@/lib/orderList";
import type { StaffRole } from "@/lib/signIn";
import { useLang, useTheme } from "../AppProviders";
import { DeskCard } from "../desk/DeskCard";
import { Table, type TableColumn } from "../desk/Table";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Photo } from "../products/parts";
import { CopyIcon } from "../staff/parts";
import { PAGE_ICONS } from "../tabIcons";
import { SPACE, TYPE } from "../theme";
import type { Home } from "./useHome";
import type { TodayMoney } from "./useTodayMoney";

interface DeskHomeProps {
  home: Home;
  role: StaffRole;
  /** The owner's วันนี้ card; null for anyone who doesn't see money, or while it loads. */
  today: TodayMoney | null;
  showsToday: boolean;
  tile: (tab: OrderTab, inCard: boolean) => React.ReactNode;
  onCopied: (said: Phrase) => void;
  offline: React.ReactNode;
  nothing: React.ReactNode;
}

/**
 * หน้าหลัก on a computer (DeskHome board, 4 Nov 2026): the shortcuts (ทำบิล red), ต้องจัดการ beside
 * the owner's วันนี้ money card, and the Shopee list as a table. The phone's หน้าหลัก is unchanged.
 */
export function DeskHome(props: DeskHomeProps) {
  const router = useRouter();
  const { t } = useLang();
  const { home } = props;
  return (
    <View style={styles.page}>
      <QuickRow role={props.role} />
      {props.offline}
      <View style={styles.cards}>
        <DeskCard
          title={t({ th: "ต้องจัดการ", en: "To do" })}
          action={{
            label: t({ th: "ดูออเดอร์", en: "See orders" }),
            onPress: () => router.push("/orders" as never),
          }}
          flex={1}
        >
          <View style={styles.tiles}>
            {HOME_TILES.map((tile) => (
              <View key={tile.tab} style={props.showsToday ? styles.tileHalf : styles.tileQuarter}>
                {props.tile(tile.tab, true)}
              </View>
            ))}
          </View>
        </DeskCard>
        {props.showsToday && <TodayCard today={props.today} />}
      </View>
      {home.items && (
        <DeskCard title={t({ th: "อัปเดตใน Shopee", en: "Update on Shopee" })} pad={4}>
          {home.items.length === 0 ? (
            props.nothing
          ) : (
            <ShopeeTable
              items={home.items}
              ticked={home.ticked}
              onToggle={home.toggle}
              onClear={home.clearDone}
              onCopied={props.onCopied}
            />
          )}
        </DeskCard>
      )}
    </View>
  );
}

/** ทำบิล · สแกน · เพิ่มสินค้า · ออกบาร์โค้ด — whichever this role's menu has; ทำบิล is the red one. */
function QuickRow({ role }: { role: StaffRole }) {
  const router = useRouter();
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View style={styles.quick}>
      {quickLinks(role).map((l, i) => {
        const red = i === 0 && l.href === "/pos";
        const ink = red ? theme.onPrimary : theme.text;
        return (
          <Pressable
            key={l.href}
            onPress={() => router.push(l.href as never)}
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.quickButton,
              {
                backgroundColor: red
                  ? pressed
                    ? theme.primaryPressed
                    : theme.button
                  : pressed
                    ? theme.border
                    : theme.hover,
              },
            ]}
          >
            <LineIcon d={PAGE_ICONS[l.href] ?? ICON.plus} color={ink} size={17} strokeWidth={2} />
            <Text style={[TYPE.subhead, styles.quickLabel, { color: ink }]}>{t(l.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Change(props: { change: { arrow: string; tone: "good" | "bad" } | null }) {
  const { t } = useLang();
  const { theme } = useTheme();
  if (!props.change) return <Text style={[TYPE.footnote, { color: theme.textMuted }]}> </Text>;
  return (
    <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
      <Text style={{ color: props.change.tone === "good" ? theme.success : theme.danger }}>
        {props.change.arrow}
      </Text>
      {t({ th: " จากเมื่อวาน", en: " vs yesterday" })}
    </Text>
  );
}

/** The owner's day: ยอดขาย, กำไร, บิล — each against yesterday — and the money line since opening. */
function TodayCard({ today }: { today: TodayMoney | null }) {
  const router = useRouter();
  const { t } = useLang();
  const { theme } = useTheme();
  const stat = (label: Phrase, value: string, under: React.ReactNode) => (
    <View style={styles.stat}>
      <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(label)}</Text>
      <Text style={[styles.big, { color: theme.text }]}>{value}</Text>
      {under}
    </View>
  );
  return (
    <DeskCard
      title={t({ th: "วันนี้", en: "Today" })}
      action={{
        label: t({ th: "ดูการเงิน", en: "See finance" }),
        onPress: () => router.push("/sales" as never),
      }}
      flex={1.1}
    >
      {today ? (
        <>
          <View style={styles.stats}>
            {stat(
              { th: "ยอดขาย", en: "Sales" },
              money(today.salesSatang),
              <Change change={today.salesChange} />,
            )}
            {stat(
              { th: "กำไร", en: "Profit" },
              money(today.profitSatang),
              <Change change={today.profitChange} />,
            )}
            {stat(
              { th: "บิล", en: "Bills" },
              String(today.count.den + today.count.air),
              <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
                {t(billCountLine(today.count))}
              </Text>,
            )}
          </View>
          <TodayLine curve={today.curve} />
        </>
      ) : (
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {t({ th: "กำลังโหลด…", en: "Loading…" })}
        </Text>
      )}
    </DeskCard>
  );
}

const W = 560;
const H = 120;

/** Today's money added up since opening (solid), yesterday's whole day dashed behind it. */
function TodayLine({ curve }: { curve: TodayMoney["curve"] }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const top = Math.max(1, ...curve.today, ...curve.yesterday);
  const x = (h: number) => (h / 23) * W;
  const y = (v: number) => H - 4 - (v / top) * (H - 12);
  const path = (vals: readonly number[]) =>
    vals.map((v, h) => `${h === 0 ? "M" : "L"}${x(h).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = curve.today.length - 1;
  const area = `${path(curve.today)} L${x(last).toFixed(1)},${H - 4} L0,${H - 4} Z`;
  const key = (dashed: boolean, label: Phrase) => (
    <View style={styles.keyItem}>
      <View
        style={[
          styles.keyMark,
          dashed
            ? { borderTopWidth: 2, borderStyle: "dashed", borderColor: theme.textFaint }
            : { height: 2, backgroundColor: theme.lineA },
        ]}
      />
      <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(label)}</Text>
    </View>
  );
  return (
    <View
      accessible
      accessibilityLabel={t({
        th: "ยอดขายสะสมวันนี้เทียบเมื่อวาน",
        en: "Today's sales so far against yesterday",
      })}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Line x1={0} y1={H - 4} x2={W} y2={H - 4} stroke={theme.border} strokeWidth={1} />
        <Path d={area} fill={theme.lineA} fillOpacity={0.08} />
        <Path
          d={path(curve.yesterday)}
          fill="none"
          stroke={theme.textFaint}
          strokeWidth={2}
          strokeDasharray="5 5"
        />
        <Path d={path(curve.today)} fill="none" stroke={theme.lineA} strokeWidth={2.2} />
      </Svg>
      <View style={styles.keys}>
        {key(false, { th: "วันนี้", en: "Today" })}
        {key(true, { th: "เมื่อวาน", en: "Yesterday" })}
      </View>
    </View>
  );
}

/** Pick B as a table (owner, 4 Nov): photo, the code to copy over the grey name, the change, the tick. */
function ShopeeTable(props: {
  items: readonly ShopeeWorkItem[];
  ticked: readonly string[];
  onToggle: (productId: string) => void;
  onClear: () => void;
  onCopied: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const done = props.ticked.length;
  const columns: TableColumn<ShopeeWorkItem>[] = [
    {
      key: "photo",
      label: "",
      width: 48,
      cell: (i) => <Photo imageKey={i.imageKey} size={48} radius={10} />,
    },
    {
      key: "code",
      label: t({ th: "รหัส · ชื่อสินค้า", en: "Code · product" }),
      cell: (i) => (
        <View style={styles.codeCell}>
          <View style={styles.codeLine}>
            <Text style={[TYPE.subhead, { color: theme.text }]}>{i.productRef}</Text>
            <CopyIcon
              value={i.productRef}
              what={{ th: ` ${i.productRef} `, en: i.productRef }}
              onCopied={props.onCopied}
            />
          </View>
          <Text style={[TYPE.footnote, { color: theme.textMuted }]} numberOfLines={1}>
            {i.name}
          </Text>
        </View>
      ),
    },
    {
      key: "change",
      label: t({ th: "ต้องทำใน Shopee", en: "On Shopee" }),
      width: 170,
      cell: (i) => (
        <Text style={[TYPE.subhead, { color: theme.text }]}>
          {t(shopeeChange(i.deltaSinceSync))}
        </Text>
      ),
    },
    {
      key: "done",
      label: t({ th: "ทำแล้ว", en: "Done" }),
      width: 56,
      align: "right",
      cell: (i) => {
        const on = props.ticked.includes(i.productId);
        return (
          <Pressable
            onPress={() => props.onToggle(i.productId)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={t({ th: `ทำแล้ว ${i.name}`, en: `Done: ${i.name}` })}
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
        );
      },
    },
  ];
  return (
    <>
      <Table columns={columns} rows={props.items} rowKey={(i) => i.productId} minRowHeight={68} />
      {done > 0 && (
        <View style={[styles.foot, { borderTopColor: theme.border }]}>
          <Text style={[TYPE.footnote, styles.grow, { color: theme.textMuted }]}>
            {t(doneLine(done, props.items.length))}
          </Text>
          <Pressable onPress={props.onClear} accessibilityRole="button" hitSlop={10}>
            <Text style={[TYPE.subhead, { color: theme.primary }]}>
              {t({ th: "ล้างที่ทำแล้ว", en: "Clear done" })}
            </Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.xl, marginTop: SPACE.xl },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.s },
  quickButton: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quickLabel: { fontWeight: "600" },
  cards: { flexDirection: "row", alignItems: "stretch", gap: SPACE.xl },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.m },
  tileHalf: { flexBasis: "47%", flexGrow: 1 },
  tileQuarter: { flexBasis: "22%", flexGrow: 1 },
  stats: { flexDirection: "row", gap: SPACE.xl, marginBottom: SPACE.m },
  stat: { flex: 1, minWidth: 0, gap: 2 },
  big: { fontSize: 26, lineHeight: 32, fontWeight: "600", fontVariant: ["tabular-nums"] },
  keys: { flexDirection: "row", gap: SPACE.l, marginTop: SPACE.s },
  keyItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  keyMark: { width: 14 },
  codeCell: { minWidth: 0 },
  codeLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  tick: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.l,
    paddingTop: SPACE.m,
    paddingBottom: SPACE.s,
    borderTopWidth: 1,
  },
  grow: { flex: 1 },
});
