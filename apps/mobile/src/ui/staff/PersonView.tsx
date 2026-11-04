import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import { dayPill, parseDayField, shortDate } from "@/lib/orderList";
import {
  OWNER_LOCK_LINE,
  accessState,
  halvesWord,
  monthLabel,
  personPayLine,
  seenWhen,
  thisMonth,
} from "@/lib/staffPage";
import type { DayOff, StaffProfile } from "@/lib/teamApi";
import { useLang, useTheme } from "../AppProviders";
import { Group } from "../orders/parts";
import { Divider, Heading, Line } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { spacedPin } from "./CodeSheets";
import { Chevron, CopyIcon, Hint, ValueRow } from "./parts";
import { BASE } from "./Tabs";
import { useDaysOff, usePayments } from "./useStaffData";

const MONTHS_ON_PAGE = 3;

/** The person's page as read (canvas v292, 3.1), in the order the owner set on 2 Nov 2026. */
export function PersonView(props: {
  person: StaffProfile;
  stamp: number;
  onCopied: (said: Phrase) => void;
  onPassword: () => void;
  onPin: () => void;
  onDayOff: (d: DayOff) => void;
  /** Left out where ลบคนนี้ can't work: the owner's locked account, and your own page. */
  onDelete?: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const p = props.person;
  const now = Date.now();
  const pay = usePayments(p.id, props.stamp);
  const off = useDaysOff(thisMonth(now), props.stamp, p.id);
  const access = accessState(p, now);
  const copy = (what: Phrase) => ({ what, onCopied: props.onCopied });
  const dot = { red: theme.primary, grey: theme.textMuted, green: theme.success }[access.dot];
  const months = (pay.months ?? []).slice(0, MONTHS_ON_PAGE);
  const daysOff = off.days ?? [];
  const page = `${BASE}/${encodeURIComponent(p.id)}/pay`;

  return (
    <View>
      <Heading text={t({ th: "ชื่อ", en: "Name" })} />
      <Group>
        <ValueRow label={t({ th: "ชื่อเล่น ไทย", en: "Nickname (Thai)" })} value={p.nameTh} />
        <ValueRow label={t({ th: "ชื่อเล่น อังกฤษ", en: "Nickname (English)" })} value={p.nameEn} />
        <ValueRow label={t({ th: "ชื่อจริง ไทย", en: "Full name (Thai)" })} value={p.fullNameTh} />
        <ValueRow
          label={t({ th: "ชื่อจริง อังกฤษ", en: "Full name (English)" })}
          value={p.fullNameEn}
          last
        />
      </Group>

      <Heading text={t({ th: "ผู้ติดต่อฉุกเฉิน", en: "Emergency contact" })} />
      <Group>
        <ValueRow label={t({ th: "ชื่อ", en: "Name" })} value={p.emergencyName} />
        <ValueRow label={t({ th: "เกี่ยวข้องเป็น", en: "Relation" })} value={p.emergencyRelation} />
        <ValueRow
          label={t({ th: "เบอร์โทร", en: "Phone" })}
          value={p.emergencyPhone}
          copy={copy({ th: "เบอร์โทร", en: "phone number" })}
          last
        />
      </Group>

      <Heading text={t({ th: "งาน", en: "Work" })} />
      <Group>
        <ValueRow
          label={t({ th: "ค่าแรงต่อวัน", en: "Day rate" })}
          value={p.dayRateSatang == null ? null : formatBaht(p.dayRateSatang)}
        />
        <ValueRow
          label={t({ th: "เริ่มงาน", en: "Started" })}
          value={p.startedOn == null ? null : t(dayPill(p.startedOn))}
          last
        />
      </Group>

      <Heading text={t({ th: "บัญชีธนาคาร", en: "Bank account" })} />
      <Group>
        <ValueRow label={t({ th: "ธนาคาร", en: "Bank" })} value={p.bankName} />
        <ValueRow
          label={t({ th: "เลขบัญชี", en: "Account no." })}
          value={p.bankAccountNo}
          copy={copy({ th: "เลขบัญชี", en: "account number" })}
        />
        <ValueRow
          label={t({ th: "ชื่อบัญชี", en: "Account name" })}
          value={p.bankAccountName}
          last
        />
      </Group>

      {p.dayRateSatang != null && (
        <>
          <Heading text={t({ th: "เงินเดือน", en: "Salary" })} />
          <Group>
            {months.map((m) => (
              <ValueRow
                key={m.period}
                label={t(monthLabel(m.period))}
                value={t(personPayLine(m))}
                onPress={
                  m.paidAt == null ? undefined : () => router.push(`${page}/${m.period}` as never)
                }
                right={m.paidAt == null ? null : <Chevron />}
              />
            ))}
            <Line
              label={t({ th: "ดูเงินเดือนทั้งหมด", en: "All salary" })}
              onPress={() => router.push(page as never)}
              right={<Chevron />}
              last
            />
          </Group>
        </>
      )}

      <Heading text={t({ th: "วันหยุด", en: "Days off" })} />
      <Group>
        {daysOff.length === 0 ? (
          <Line label={t({ th: "ไม่มีวันหยุดเดือนนี้", en: "No days off this month" })} last />
        ) : (
          daysOff.map((d, i) => (
            <ValueRow
              key={d.id}
              label={`${t(shortDate(parseDayField(d.day) ?? 0))} · ${t(halvesWord(d.halves))}`}
              value={d.reason ?? ""}
              onPress={() => props.onDayOff(d)}
              last={i === daysOff.length - 1}
            />
          ))
        )}
      </Group>

      <Heading text={t({ th: "การเข้าใช้งาน", en: "Sign-in" })} />
      <Group>
        <Line
          label={t({ th: "สถานะ", en: "Status" })}
          right={
            <View style={styles.status}>
              <View style={[styles.dot, { backgroundColor: dot }]} />
              <Text style={[TYPE.body, { color: theme.text }]}>{t(access.text)}</Text>
            </View>
          }
        />
        <ValueRow
          label={t({ th: "เข้าใช้ล่าสุด", en: "Last sign-in" })}
          value={
            p.lastLoginAt == null
              ? t({ th: "ยังไม่เคย", en: "Never" })
              : t(seenWhen(p.lastLoginAt, now))
          }
        />
        <CodeRow
          label={t({ th: "รหัสผ่าน", en: "Password" })}
          shown={p.hasPassword ? "••••••••" : t({ th: "ยังไม่ได้ตั้ง", en: "Not set" })}
          value={p.password}
          what={{ th: "รหัสผ่าน", en: "password" }}
          onCopied={props.onCopied}
          onPress={props.onPassword}
        />
        <CodeRow
          label={t({ th: "รหัส 6 หลัก", en: "6-digit code" })}
          shown={p.hasPin ? spacedPin("••••••") : t({ th: "ยังไม่ได้ตั้ง", en: "Not set" })}
          value={p.pin}
          what={{ th: "รหัส 6 หลัก", en: "code" }}
          onCopied={props.onCopied}
          onPress={props.onPin}
          last
        />
      </Group>

      {p.locked && <Hint text={t(OWNER_LOCK_LINE)} />}
      {props.onDelete && (
        <View style={styles.deleteGroup}>
          <Group>
            <Pressable onPress={props.onDelete} accessibilityRole="button" style={styles.deleteRow}>
              <Text style={[TYPE.body, { color: theme.danger }]}>
                {t({ th: "ลบคนนี้", en: "Delete this person" })}
              </Text>
            </Pressable>
          </Group>
        </View>
      )}
    </View>
  );
}

/**
 * รหัสผ่าน / รหัส 6 หลัก: hidden dots, the copy mark for the real one, › to change it. The row and the
 * copy mark are side-by-side tap areas — on the web a press inside a press would fire both.
 */
function CodeRow(props: {
  label: string;
  shown: string;
  value: string | null;
  what: Phrase;
  onCopied: (said: Phrase) => void;
  onPress: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <View style={styles.codeRow}>
        <Pressable onPress={props.onPress} accessibilityRole="button" style={styles.codeMain}>
          <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{props.label}</Text>
          <Text style={[TYPE.body, { color: theme.text }]}>{props.shown}</Text>
        </Pressable>
        {props.value ? (
          <CopyIcon value={props.value} what={props.what} onCopied={props.onCopied} />
        ) : null}
        <Pressable
          onPress={props.onPress}
          accessibilityRole="button"
          accessibilityLabel={props.label}
          style={styles.codeEnd}
        >
          <Chevron />
        </Pressable>
      </View>
      {!props.last && <Divider />}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  dot: { width: 8, height: 8, borderRadius: 4 },
  deleteGroup: { marginTop: SPACE.xxl },
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
  codeRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: SPACE.s },
  codeMain: {
    flex: 1,
    minHeight: 52,
    paddingLeft: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  grow: { flex: 1, minWidth: 0 },
  codeEnd: { minHeight: 52, paddingRight: SPACE.l, justifyContent: "center" },
});
