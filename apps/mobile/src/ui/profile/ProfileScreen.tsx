import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { initials } from "@/lib/initials";
import { formatBaht } from "@/lib/money";
import { dayPill, parseDayField, shortDate } from "@/lib/orderList";
import type { OwnProfile } from "@/lib/profileApi";
import {
  ACCESS_LABEL,
  OWN_PAY_ROUTE,
  PAY_DAY,
  accessRows,
  codeShown,
  daysInOrder,
  ownPayMonthRoute,
  profileSections,
  type Access,
  type Section,
} from "@/lib/profilePage";
import {
  halvesWord,
  monthLabel,
  personPayLine,
  roleWord,
  shownName,
  thisMonth,
} from "@/lib/staffPage";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { Group } from "../orders/parts";
import { AddRow, Heading, Line, SwitchRow } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { Chevron, CopyIcon, ValueRow } from "../staff/parts";
import { usePayments } from "../staff/useStaffData";
import { useToast } from "../staff/useTeam";
import { RADIUS, SPACE, TYPE } from "../theme";
import { useWide } from "../desk/useWide";
import { OwnCodeSheet, OwnDayOffSheet } from "./ProfileSheets";
import { useOwnDaysOff, useOwnProfile } from "./useOwnProfile";

type Open = Access | "dayOff" | null;

const MONTHS_ON_PAGE = 3;
const TITLE: Phrase = { th: "โปรไฟล์ของฉัน", en: "My profile" };

/**
 * โปรไฟล์ของฉัน (canvas v335, 4 Nov 2026): the badge you tapped, ตำแหน่ง · ชื่อเล่น and your phone,
 * then the sections in the owner's order. Read only; ภาษา · โหมดมืด · ออกจากระบบ live here now
 * (they were the ☰ menu's small account sheet).
 */
export function ProfileScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const badge = auth.status === "signed-in" ? auth.staff.name : "";
  const [stamp, setStamp] = useState(0);
  const me = useOwnProfile(stamp);
  const { toast, showToast } = useToast();
  const [open, setOpen] = useState<Open>(null);
  // Computer (canvas คอม · โปรไฟล์ของฉัน): opened from your name at the foot of the menu, so the page
  // has the plain title and no ‹; your badge sits in a card beside your name.
  const wide = useWide();

  const leave = () => (router.canGoBack() ? router.back() : router.replace("/" as never));
  useScreenChrome(null, [], {
    back: wide ? null : { label: "", onPress: leave },
    ownTitle: !wide,
    title: wide ? t(TITLE) : null,
    toast: toast ? { title: t(toast.title), detail: t(toast.detail) } : null,
  });

  const done = (said: Phrase) => {
    setOpen(null);
    showToast(said);
    setStamp((n) => n + 1);
  };

  const p = me.profile;
  return (
    <View>
      {/* On the back pill's line, but never over it: taps go through to ‹. */}
      {!wide && (
        <View style={styles.top} pointerEvents="none">
          <Text style={[TYPE.headline, { color: theme.text }]} accessibilityRole="header">
            {t(TITLE)}
          </Text>
        </View>
      )}

      {!p ? (
        me.failed ? (
          <Retry onPress={() => void me.load()} />
        ) : (
          <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
        )
      ) : (
        <>
          {wide ? (
            <WideHero
              badge={badge}
              name={`${t(roleWord(p.role))} · ${shownName(p)}`}
              phone={p.phone}
              onCopied={(said) => showToast(said)}
            />
          ) : (
            <View style={styles.hero}>
              <View style={[styles.avatar, { backgroundColor: theme.segBg }]}>
                <Text style={[styles.avatarText, { color: theme.text }]}>{initials(badge)}</Text>
              </View>
              <Text style={[TYPE.title1, styles.name, { color: theme.text }]}>
                {`${t(roleWord(p.role))} · ${shownName(p)}`}
              </Text>
              {p.phone ? (
                <View style={styles.phone}>
                  <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{p.phone}</Text>
                  <CopyIcon
                    value={p.phone}
                    what={{ th: "เบอร์โทร", en: "phone number" }}
                    onCopied={(said) => showToast(said)}
                  />
                </View>
              ) : null}
            </View>
          )}

          {profileSections(p).map((s) => (
            <SectionView
              key={s}
              section={s}
              p={p}
              stamp={stamp}
              onCopied={(said) => showToast(said)}
              onOpen={setOpen}
            />
          ))}

          <View style={styles.signOutGroup}>
            <Group>
              <Pressable
                onPress={() => void auth.signOutNow()}
                accessibilityRole="button"
                style={[styles.signOut, wide && styles.signOutWide]}
              >
                <Text style={[TYPE.body, { color: theme.danger }]}>
                  {t({ th: "ออกจากระบบ", en: "Sign out" })}
                </Text>
              </Pressable>
            </Group>
          </View>

          {open === "dayOff" && (
            <OwnDayOffSheet token={token} onClose={() => setOpen(null)} onDone={done} />
          )}
          {open && open !== "dayOff" && (
            <OwnCodeSheet
              kind={open}
              token={token}
              now={open === "password" ? p.password : open === "pin" ? p.pin : null}
              setAt={open === "key" && p.hasRecoveryKey ? p.recoverySetAt : null}
              onClose={() => setOpen(null)}
              onDone={done}
            />
          )}
        </>
      )}
    </View>
  );
}

/** Computer: your badge in a card with your name and phone beside it (canvas คอม · โปรไฟล์ของฉัน 1). */
function WideHero(props: {
  badge: string;
  name: string;
  phone: string | null;
  onCopied: (said: Phrase) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.heroCard,
        { backgroundColor: theme.surface, borderWidth: theme.cardLine, borderColor: theme.border },
      ]}
    >
      <View style={[styles.wideAvatar, { backgroundColor: theme.graphite }]}>
        <Text style={[styles.wideAvatarText, { color: theme.onPrimary }]}>
          {initials(props.badge)}
        </Text>
      </View>
      <View style={styles.heroWords}>
        <Text style={[TYPE.title2, styles.heroName, { color: theme.text }]}>{props.name}</Text>
        {props.phone ? (
          <View style={styles.phone}>
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{props.phone}</Text>
            <CopyIcon
              value={props.phone}
              what={{ th: "เบอร์โทร", en: "phone number" }}
              onCopied={props.onCopied}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SectionView(props: {
  section: Section;
  p: OwnProfile;
  stamp: number;
  onCopied: (said: Phrase) => void;
  onOpen: (o: Open) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const wide = useWide();
  const { p } = props;
  const copy = (what: Phrase) => ({ what, onCopied: props.onCopied });
  // A computer names each card with a small grey word above it, as System Settings does (canvas คอม).
  const block = (title: Phrase, rows: ReactNode) => (
    <>
      {wide ? (
        <Text
          style={[TYPE.footnote, styles.wideHeading, { color: theme.textMuted }]}
          accessibilityRole="header"
        >
          {t(title)}
        </Text>
      ) : (
        <Heading text={t(title)} />
      )}
      <Group>{rows}</Group>
    </>
  );

  switch (props.section) {
    case "name":
      return block(
        { th: "ชื่อ", en: "Name" },
        <>
          <ValueRow label={t({ th: "ชื่อเล่น ไทย", en: "Nickname (Thai)" })} value={p.nameTh} />
          <ValueRow
            label={t({ th: "ชื่อเล่น อังกฤษ", en: "Nickname (English)" })}
            value={p.nameEn}
          />
          <ValueRow
            label={t({ th: "ชื่อจริง ไทย", en: "Full name (Thai)" })}
            value={p.fullNameTh}
          />
          <ValueRow
            label={t({ th: "ชื่อจริง อังกฤษ", en: "Full name (English)" })}
            value={p.fullNameEn}
            last
          />
        </>,
      );
    case "app":
      return block({ th: "แอป", en: "App" }, <AppRows />);
    case "access":
      return block(
        { th: "การเข้าใช้งาน", en: "Sign-in" },
        <AccessRows p={p} onOpen={props.onOpen} />,
      );
    case "work":
      return block(
        { th: "งาน", en: "Work" },
        <>
          <ValueRow
            label={t({ th: "ค่าแรงต่อวัน", en: "Day rate" })}
            value={p.dayRateSatang == null ? null : formatBaht(p.dayRateSatang)}
          />
          <ValueRow
            label={t({ th: "เริ่มงาน", en: "Started" })}
            value={p.startedOn == null ? null : t(dayPill(p.startedOn))}
          />
          <ValueRow label={t({ th: "วันจ่ายเงิน", en: "Pay day" })} value={t(PAY_DAY)} last />
        </>,
      );
    case "bank":
      return block(
        { th: "บัญชีธนาคาร", en: "Bank account" },
        <>
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
        </>,
      );
    case "pay":
      return block({ th: "เงินเดือน", en: "Salary" }, <PayRows id={p.id} stamp={props.stamp} />);
    case "daysOff":
      return block(
        { th: "วันหยุด", en: "Days off" },
        <DayOffRows stamp={props.stamp} onAdd={() => props.onOpen("dayOff")} />,
      );
    case "emergency":
      return block(
        { th: "ผู้ติดต่อฉุกเฉิน", en: "Emergency contact" },
        <>
          <ValueRow label={t({ th: "ชื่อ", en: "Name" })} value={p.emergencyName} />
          <ValueRow
            label={t({ th: "เกี่ยวข้องเป็น", en: "Relation" })}
            value={p.emergencyRelation}
          />
          <ValueRow
            label={t({ th: "เบอร์โทร", en: "Phone" })}
            value={p.emergencyPhone}
            copy={copy({ th: "เบอร์โทร", en: "phone number" })}
            last
          />
        </>,
      );
  }
}

/** ภาษา and โหมดมืด: they change the whole app at once, as they did in the ☰ menu. */
function AppRows() {
  const { isDark, toggleTheme } = useTheme();
  const { lang, t, toggleLang } = useLang();
  return (
    <>
      <Line
        label={t({ th: "ภาษา", en: "Language" })}
        right={
          <View style={styles.langSwitch}>
            <Segmented
              label={t({ th: "ภาษา", en: "Language" })}
              options={[
                { value: "th", label: "ไทย" },
                { value: "en", label: "EN" },
              ]}
              value={lang}
              onChange={(v) => v !== lang && toggleLang()}
            />
          </View>
        }
      />
      <SwitchRow
        label={t({ th: "โหมดมืด", en: "Dark mode" })}
        value={isDark}
        onChange={toggleTheme}
        last
      />
    </>
  );
}

function AccessRows({ p, onOpen }: { p: OwnProfile; onOpen: (o: Open) => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const isSet = { password: p.hasPassword, pin: p.hasPin, key: p.hasRecoveryKey };
  const rows = accessRows(p);
  return (
    <>
      {rows.map((a, i) => (
        <Line
          key={a}
          label={t(ACCESS_LABEL[a])}
          onPress={() => onOpen(a)}
          last={i === rows.length - 1}
          right={
            <View style={styles.right}>
              <Text style={[TYPE.body, { color: theme.text }]}>{t(codeShown(a, isSet[a]))}</Text>
              <Chevron />
            </View>
          }
        />
      ))}
    </>
  );
}

/** Your last three months, as the person page shows them; paid ones open, read only. */
function PayRows({ id, stamp }: { id: string; stamp: number }) {
  const { t } = useLang();
  const pay = usePayments(id, stamp);
  const months = (pay.months ?? []).slice(0, MONTHS_ON_PAGE);
  return (
    <>
      {months.map((m) => (
        <ValueRow
          key={m.period}
          label={t(monthLabel(m.period))}
          value={t(personPayLine(m))}
          onPress={
            m.paidAt == null ? undefined : () => router.push(ownPayMonthRoute(m.period) as never)
          }
          right={m.paidAt == null ? null : <Chevron />}
        />
      ))}
      <Line
        label={t({ th: "ดูเงินเดือนทั้งหมด", en: "All salary" })}
        onPress={() => router.push(OWN_PAY_ROUTE as never)}
        right={<Chevron />}
        last
      />
    </>
  );
}

/** This month's days off in date order, then ＋ บันทึกวันหยุด. Yours are not tappable: no delete. */
function DayOffRows({ stamp, onAdd }: { stamp: number; onAdd: () => void }) {
  const { t } = useLang();
  const off = useOwnDaysOff(thisMonth(Date.now()), stamp);
  const days = daysInOrder(off.days ?? []);
  return (
    <>
      {days.length === 0 ? (
        <Line label={t({ th: "ไม่มีวันหยุดเดือนนี้", en: "No days off this month" })} />
      ) : (
        days.map((d) => {
          const label = `${t(shortDate(parseDayField(d.day) ?? 0))} · ${t(halvesWord(d.halves))}`;
          // No reason → nothing on the right (as drawn), not ValueRow's "—".
          return d.reason ? (
            <ValueRow key={d.id} label={label} value={d.reason} />
          ) : (
            <Line key={d.id} label={label} />
          );
        })
      )}
      <AddRow label={t({ th: "บันทึกวันหยุด", en: "Record a day off" })} onPress={onAdd} />
    </>
  );
}

const AVATAR = 96;
const WIDE_AVATAR = 64;

const styles = StyleSheet.create({
  // The frame's back pill is 36 tall with 8 under it; the title sits centred on its line.
  top: { marginTop: -44, height: 36, alignItems: "center", justifyContent: "center" },
  hero: { marginTop: SPACE.m, alignItems: "center" },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32, fontWeight: "700" },
  name: { marginTop: 14, textAlign: "center" },
  phone: { flexDirection: "row", alignItems: "center", gap: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  langSwitch: { width: 140 },
  signOutGroup: { marginTop: SPACE.xl },
  signOut: { minHeight: 52, alignItems: "center", justifyContent: "center" },
  // Computer (canvas คอม · โปรไฟล์ของฉัน): the badge card, small grey headings, ออกจากระบบ on the left.
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    padding: SPACE.xl,
    borderRadius: RADIUS.card,
  },
  wideAvatar: {
    width: WIDE_AVATAR,
    height: WIDE_AVATAR,
    borderRadius: WIDE_AVATAR / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  wideAvatarText: { fontSize: 24, fontWeight: "600" },
  heroWords: { flex: 1, minWidth: 0, gap: 2 },
  heroName: { fontWeight: "600" },
  wideHeading: {
    fontWeight: "600",
    marginTop: SPACE.xl,
    marginBottom: SPACE.s,
    marginHorizontal: SPACE.xs,
  },
  signOutWide: { alignItems: "flex-start", paddingHorizontal: SPACE.l },
});
