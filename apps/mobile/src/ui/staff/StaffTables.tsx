import { StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import {
  dayOffTitle,
  halvesWord,
  lastSeenDay,
  payState,
  positionWord,
  shownName,
  type PayRow,
} from "@/lib/staffPage";
import { photoPath, type DayOff } from "@/lib/teamApi";
import { useLang, useTheme } from "../AppProviders";
import { DeskCard } from "../desk/DeskCard";
import { Table, type TableColumn } from "../desk/Table";
import { SPACE, TYPE } from "../theme";
import { Avatar } from "./parts";
import type { TeamMember } from "./useTeam";

/** A person in a table's first column: their round badge and name (DeskStaff 1 and 4). */
function Who(props: { name: string; owner?: boolean; photo?: string | null }) {
  const { theme } = useTheme();
  return (
    <View style={styles.who}>
      <Avatar name={props.name} owner={props.owner} photo={props.photo} size={36} />
      <Text style={[TYPE.subhead, styles.grow, { color: theme.text }]} numberOfLines={2}>
        {props.name}
      </Text>
    </View>
  );
}

/**
 * คน on a computer (DeskStaff 1): one row each — who, their position (ปิดอยู่ with its grey dot when
 * switched off) and the day they last signed in, no clock time. A row opens the person's page.
 */
export function PeopleTable(props: {
  people: readonly TeamMember[];
  now: number;
  onOpen: (p: TeamMember) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const grey = [TYPE.subhead, { color: theme.textMuted }];
  const columns: TableColumn<TeamMember>[] = [
    {
      key: "who",
      label: t({ th: "ชื่อ", en: "Name" }),
      cell: (p) => (
        <Who
          name={shownName(p)}
          owner={p.role === "super_admin"}
          photo={p.hasPhoto ? photoPath(p.id) : null}
        />
      ),
    },
    {
      key: "role",
      label: t({ th: "ตำแหน่ง", en: "Position" }),
      width: 200,
      cell: (p) => {
        const pos = positionWord(p);
        return (
          <View style={styles.state}>
            {pos.dot && <View style={[styles.dot, { backgroundColor: theme.textMuted }]} />}
            <Text style={grey} numberOfLines={1}>
              {t(pos.text)}
            </Text>
          </View>
        );
      },
    },
    {
      key: "seen",
      label: t({ th: "เข้าใช้ล่าสุด", en: "Last sign-in" }),
      width: 200,
      cell: (p) => (
        <Text style={grey} numberOfLines={1}>
          {t(lastSeenDay(p.lastLoginAt, props.now))}
        </Text>
      ),
    },
  ];
  return (
    <DeskCard pad={4}>
      <Table
        columns={columns}
        rows={props.people}
        rowKey={(p) => p.id}
        onPress={props.onOpen}
        rowLabel={(p) => `${shownName(p)} ${t(positionWord(p).text)}`}
        minRowHeight={64}
      />
    </DeskCard>
  );
}

/**
 * เงินเดือน on a computer (DeskStaff 4): who, the month's whole pay (right) and the day it was paid or
 * ที่ต้องจ่าย. A row does what the phone row does: pay, or open the paid month.
 */
export function SalaryTable(props: { rows: readonly PayRow[]; onOpen: (r: PayRow) => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const columns: TableColumn<PayRow>[] = [
    { key: "who", label: t({ th: "ชื่อ", en: "Name" }), cell: (r) => <Who name={r.name} /> },
    {
      key: "pay",
      label: t({ th: "เงินเดือน", en: "Salary" }),
      width: 140,
      align: "right",
      cell: (r) => (
        <Text style={[TYPE.subhead, styles.nums, { color: theme.text }]} numberOfLines={1}>
          {formatBaht(r.amountSatang)}
        </Text>
      ),
    },
    {
      key: "state",
      label: t({ th: "การจ่าย", en: "Payment" }),
      width: 200,
      cell: (r) => (
        <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
          {t(payState(r))}
        </Text>
      ),
    },
  ];
  return (
    <DeskCard pad={4}>
      <Table
        columns={columns}
        rows={props.rows}
        rowKey={(r) => r.userId}
        onPress={props.onOpen}
        rowLabel={(r) => `${r.name} ${t(payState(r))}`}
        minRowHeight={64}
      />
    </DeskCard>
  );
}

/** A day off in the table, and whether it is the first of its day (the date shows once). */
export interface DayOffLine {
  day: DayOff;
  first: boolean;
}

/**
 * วันหยุด on a computer (DeskStaff 5): newest day first, the date once for each day, who (with the
 * reason in grey) and how much of the day. A row opens the day off to change or delete it.
 */
export function DaysOffTable(props: { lines: readonly DayOffLine[]; onOpen: (d: DayOff) => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const columns: TableColumn<DayOffLine>[] = [
    {
      key: "day",
      label: t({ th: "วันที่", en: "Date" }),
      width: 170,
      cell: (l) => (
        <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
          {l.first ? t(dayOffTitle(l.day.day)) : ""}
        </Text>
      ),
    },
    {
      key: "who",
      label: t({ th: "คน", en: "Person" }),
      cell: (l) => (
        <Text style={[TYPE.subhead, { color: theme.text }]} numberOfLines={2}>
          {l.day.name}
          {l.day.reason ? (
            <Text style={{ color: theme.textMuted }}>{` · ${l.day.reason}`}</Text>
          ) : null}
        </Text>
      ),
    },
    {
      key: "much",
      label: t({ th: "หยุดแค่ไหน", en: "How long" }),
      width: 120,
      cell: (l) => (
        <Text style={[TYPE.subhead, { color: theme.text }]} numberOfLines={1}>
          {t(halvesWord(l.day.halves))}
        </Text>
      ),
    },
  ];
  return (
    <DeskCard pad={4}>
      <Table
        columns={columns}
        rows={props.lines}
        rowKey={(l) => l.day.id}
        onPress={(l) => props.onOpen(l.day)}
        rowLabel={(l) =>
          `${t(dayOffTitle(l.day.day))} ${l.day.name} ${t(halvesWord(l.day.halves))}`
        }
        minRowHeight={52}
      />
    </DeskCard>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: "row", alignItems: "center", gap: SPACE.m, minWidth: 0 },
  grow: { flex: 1, minWidth: 0 },
  state: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  nums: { fontVariant: ["tabular-nums"] },
});
