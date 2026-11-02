import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  activityText,
  dayHeading,
  dayOffTitle,
  halvesWord,
  monthLabel,
  monthSummary,
  personLine,
  recentMonths,
  salaryLine,
  shownName,
  teamOrder,
  type PayRow,
} from "@/lib/staffPage";
import { photoPath, type DayOff } from "@/lib/teamApi";
import { clockTime, startOfDay } from "@/lib/orderList";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { MenuButton } from "../orders/MenuButton";
import { Group } from "../orders/parts";
import { Divider } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { Avatar, Chevron, DayLabel } from "./parts";
import { useActivity, useDaysOff, useSalary } from "./useStaffData";
import type { TeamMember } from "./useTeam";

export const BASE = "/settings/staff";
const MONTHS_SHOWN = 6;

function Loading({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { theme } = useTheme();
  return failed ? (
    <Retry onPress={onRetry} />
  ) : (
    <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
  );
}

function Nothing({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[TYPE.subhead, styles.none, { color: theme.textMuted }]}>{text}</Text>;
}

/** The month ▾ over เงินเดือน, วันหยุด and ประวัติ. */
function MonthMenu(props: { value: string; onPick: (month: string) => void }) {
  const { t } = useLang();
  const options = recentMonths(Date.now(), MONTHS_SHOWN).map((m) => ({
    key: m,
    label: monthLabel(m),
  }));
  return (
    <MenuButton
      name={t({ th: "เดือน", en: "Month" })}
      label={t(monthLabel(props.value))}
      on={false}
      options={options}
      value={props.value}
      onPick={props.onPick}
    />
  );
}

/** คน: everyone as a card — who they are, their position and when they last signed in. */
export function PeopleTab(props: {
  people: TeamMember[] | null;
  failed: boolean;
  onRetry: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  if (!props.people) return <Loading failed={props.failed} onRetry={props.onRetry} />;
  const now = Date.now();
  return (
    <View style={styles.cards}>
      {teamOrder(props.people).map((p) => {
        const line = personLine(p, now);
        return (
          <Pressable
            key={p.id}
            onPress={() => router.push(`${BASE}/${encodeURIComponent(p.id)}` as never)}
            accessibilityRole="button"
            style={[styles.card, { backgroundColor: theme.surface }]}
          >
            <Avatar
              name={shownName(p)}
              owner={p.role === "super_admin"}
              photo={p.hasPhoto ? photoPath(p.id) : null}
              size={48}
            />
            <View style={styles.grow}>
              <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={1}>
                {shownName(p)}
              </Text>
              <View style={styles.subRow}>
                {line.dot && <View style={[styles.dot, { backgroundColor: theme.textMuted }]} />}
                <Text style={[TYPE.footnote, { color: theme.textMuted }]} numberOfLines={1}>
                  {t(line.text)}
                </Text>
              </View>
            </View>
            <Chevron />
          </Pressable>
        );
      })}
    </View>
  );
}

/** เงินเดือน: the month's card C, then each person — tap one to pay, or a paid one to see it. */
export function SalaryTab(props: {
  month: string;
  onMonth: (m: string) => void;
  stamp: number;
  onPay: (row: PayRow) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const salary = useSalary(props.month, props.stamp);
  const rows = salary.rows;
  const sum = rows ? monthSummary(rows) : null;
  return (
    <View>
      <View style={styles.menus}>
        <MonthMenu value={props.month} onPick={props.onMonth} />
      </View>
      {!rows || !sum ? (
        <Loading failed={salary.failed} onRetry={() => void salary.load()} />
      ) : rows.length === 0 ? (
        <Nothing
          text={t({
            th: "ยังไม่มีใครมีค่าแรงต่อวัน · ใส่ที่หน้าของแต่ละคน",
            en: "Nobody has a day rate yet · add it on each person's page",
          })}
        />
      ) : (
        <>
          <View style={[styles.summary, { backgroundColor: theme.surface }]}>
            <View style={styles.summaryTop}>
              <Text style={[TYPE.footnote, styles.grow, { color: theme.textMuted }]}>
                {t({ th: "รวมเดือนนี้", en: "This month" })}
              </Text>
              <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(sum.count)}</Text>
            </View>
            <Text style={[styles.total, { color: theme.text }]}>{sum.total}</Text>
            <View style={[styles.rule, { backgroundColor: theme.border }]} />
            <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(sum.split)}</Text>
          </View>
          <View style={styles.after}>
            <Group>
              {rows.map((r, i) => (
                <View key={r.userId}>
                  <Pressable
                    onPress={() =>
                      r.paidAt == null
                        ? props.onPay(r)
                        : router.push(
                            `${BASE}/${encodeURIComponent(r.userId)}/pay/${props.month}` as never,
                          )
                    }
                    accessibilityRole="button"
                    style={styles.row}
                  >
                    <Avatar name={r.name} size={36} />
                    <View style={styles.grow}>
                      <Text style={[TYPE.body, styles.name, { color: theme.text }]}>{r.name}</Text>
                      <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
                        {t(salaryLine(r))}
                      </Text>
                    </View>
                    <Chevron />
                  </Pressable>
                  {i < rows.length - 1 && <Divider />}
                </View>
              ))}
            </Group>
          </View>
        </>
      )}
    </View>
  );
}

/** วันหยุด: the month's days off, newest day first; tap one to change or delete it. */
export function DaysOffTab(props: {
  month: string;
  onMonth: (m: string) => void;
  stamp: number;
  onOpen: (d: DayOff) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const off = useDaysOff(props.month, props.stamp);
  const days = off.days;
  const byDay = new Map<string, DayOff[]>();
  for (const d of [...(days ?? [])].sort((a, b) => b.day.localeCompare(a.day))) {
    byDay.set(d.day, [...(byDay.get(d.day) ?? []), d]);
  }
  return (
    <View>
      <View style={styles.menus}>
        <MonthMenu value={props.month} onPick={props.onMonth} />
      </View>
      {!days ? (
        <Loading failed={off.failed} onRetry={() => void off.load()} />
      ) : days.length === 0 ? (
        <Nothing text={t({ th: "ไม่มีวันหยุดเดือนนี้", en: "No days off this month" })} />
      ) : (
        [...byDay].map(([day, list]) => (
          <View key={day}>
            <DayLabel text={t(dayOffTitle(day))} />
            <Group>
              {list.map((d, i) => (
                <View key={d.id}>
                  <Pressable
                    onPress={() => props.onOpen(d)}
                    accessibilityRole="button"
                    style={styles.line}
                  >
                    <Text style={[TYPE.body, styles.grow, { color: theme.text }]} numberOfLines={1}>
                      {d.name}
                      {d.reason ? (
                        <Text style={{ color: theme.textMuted }}>{` · ${d.reason}`}</Text>
                      ) : null}
                    </Text>
                    <Text style={[TYPE.body, { color: theme.text }]}>
                      {t(halvesWord(d.halves))}
                    </Text>
                    <Chevron />
                  </Pressable>
                  {i < list.length - 1 && <Divider />}
                </View>
              ))}
            </Group>
          </View>
        ))
      )}
    </View>
  );
}

/** ประวัติ: sign-ins, codes, days off and pay, by day; a red dot is the one to look at. */
export function HistoryTab(props: {
  people: TeamMember[] | null;
  person: string | null;
  onPerson: (id: string | null) => void;
  month: string;
  onMonth: (m: string) => void;
  stamp: number;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const history = useActivity(props.person, props.month, props.stamp);
  const rows = history.rows;
  const now = Date.now();
  const everyone = { key: "", label: { th: "ทุกคน", en: "Everyone" } };
  const people = [
    everyone,
    ...teamOrder(props.people ?? []).map((p) => ({
      key: p.id,
      label: { th: shownName(p), en: shownName(p) },
    })),
  ];
  const chosen = people.find((p) => p.key === (props.person ?? "")) ?? everyone;
  const groups: { day: number; rows: NonNullable<typeof rows> }[] = [];
  for (const r of rows ?? []) {
    const day = startOfDay(r.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(r);
    else groups.push({ day, rows: [r] });
  }
  return (
    <View>
      <View style={styles.menus}>
        <MenuButton
          name={t({ th: "คน", en: "Person" })}
          label={t(chosen.label)}
          on={false}
          options={people}
          value={chosen.key}
          onPick={(key) => props.onPerson(key || null)}
        />
        <MonthMenu value={props.month} onPick={props.onMonth} />
      </View>
      {!rows ? (
        <Loading failed={history.failed} onRetry={() => void history.load()} />
      ) : rows.length === 0 ? (
        <Nothing text={t({ th: "ไม่มีประวัติเดือนนี้", en: "Nothing this month" })} />
      ) : (
        groups.map((g) => (
          <View key={g.day}>
            <DayLabel text={t(dayHeading(g.day, now))} />
            <Group>
              {g.rows.map((r, i) => (
                <View key={r.id}>
                  <View style={styles.event}>
                    <View style={styles.eventHead}>
                      {r.kind === "locked" && (
                        <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                      )}
                      <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>
                        {t(activityText(r.kind, r.detail))}
                      </Text>
                    </View>
                    <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
                      {`${r.name} · ${clockTime(r.createdAt)}`}
                    </Text>
                  </View>
                  {i < g.rows.length - 1 && <Divider />}
                </View>
              ))}
            </Group>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { marginTop: SPACE.l, gap: SPACE.s },
  card: {
    minHeight: 72,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.m,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  grow: { flex: 1, minWidth: 0 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  menus: { marginTop: SPACE.l, flexDirection: "row", gap: SPACE.s },
  none: { textAlign: "center", marginTop: SPACE.xxxl, marginHorizontal: SPACE.l },
  summary: { marginTop: SPACE.m, borderRadius: 14, padding: SPACE.l, gap: 2 },
  summaryTop: { flexDirection: "row", alignItems: "center" },
  total: { fontSize: 34, lineHeight: 42, fontWeight: "700", fontVariant: ["tabular-nums"] },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: SPACE.s },
  after: { marginTop: SPACE.m },
  row: {
    minHeight: 60,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.s,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  name: { fontWeight: "600" },
  line: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  event: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.m, gap: 2 },
  eventHead: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
});
