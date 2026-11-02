import type { Phrase } from "@l-shopee/shared/lang";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { API_BASE } from "@/lib/config";
import { copyText } from "@/lib/copyText";
import { badgeLetters } from "@/lib/staffPage";
import { fetchImage } from "@/lib/teamApi";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Divider, Line } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { saveImage } from "./saveImage";

/** The ＋ menu's and the slip card's line icons (canvas v292), on the 24-unit grid. */
export const STAFF_ICON = {
  personAdd:
    "M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M19 8v6M16 11h6",
  calendar:
    "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4",
  money:
    "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M6 12h.01M18 12h.01",
  wallet:
    "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
  save: "M12 3v12M7 10l5 5 5-5M5 21h14",
  attach:
    "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48",
} as const;

/** A picture behind the session (a person's photo, a slip): fetched with it, shown as a data URI. */
function useStaffImage(path: string | null): { uri: string | null; failed: boolean } {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : null;
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!token || !path) return;
    let live = true;
    setUri(null);
    setFailed(false);
    fetchImage(fetch, API_BASE, token, path)
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error ?? new Error("read failed"));
            reader.readAsDataURL(blob);
          }),
      )
      .then((u) => live && setUri(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [path, token]);
  return { uri, failed };
}

/** A person's round badge: their photo, else their initials — dark for the shop's owner (as drawn). */
export function Avatar(props: {
  name: string;
  owner?: boolean;
  photo?: string | null;
  /** A picture just chosen on the phone, shown before it is saved. */
  uri?: string | null;
  size: number;
  /** The dark เปลี่ยน / เพิ่มรูป band across its foot (the forms). */
  band?: string;
}) {
  const { theme } = useTheme();
  const kept = useStaffImage(props.uri ? null : (props.photo ?? null));
  const uri = props.uri ?? kept.uri;
  const round = { width: props.size, height: props.size, borderRadius: props.size / 2 };
  const dark = props.owner === true;
  return (
    <View
      style={[
        styles.avatar,
        round,
        { backgroundColor: dark ? theme.text : theme.segBg, overflow: "hidden" },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={round} accessibilityLabel={props.name} />
      ) : props.name ? (
        <Text
          style={{
            fontSize: props.size * 0.34,
            fontWeight: "700",
            color: dark ? theme.bg : theme.text,
          }}
        >
          {badgeLetters(props.name)}
        </Text>
      ) : (
        <LineIcon d={PERSON} color={theme.textMuted} size={props.size * 0.42} strokeWidth={1.8} />
      )}
      {props.band ? (
        <View style={styles.band}>
          <Text style={styles.bandText}>{props.band}</Text>
        </View>
      ) : null}
    </View>
  );
}

const PERSON = "M20 21v-1.5a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5V21M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8";

/**
 * The plain copy mark beside a value (owner: no grey circle round it). On a page it says so in the
 * page's toast; in a sheet (`onCopied` left out) the mark turns into a ✓ for a moment instead,
 * because a toast would sit hidden under the sheet.
 */
export function CopyIcon(props: {
  value: string;
  what: Phrase;
  onCopied?: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), TICK_MS);
    return () => clearTimeout(timer);
  }, [done]);
  const copy = async () => {
    const ok = await copyText(props.value);
    if (props.onCopied) {
      props.onCopied(
        ok
          ? { th: `คัดลอก${props.what.th}แล้ว`, en: `Copied the ${props.what.en}` }
          : { th: "คัดลอกไม่ได้", en: "Could not copy" },
      );
    } else if (ok) setDone(true);
  };
  return (
    <Pressable
      onPress={() => void copy()}
      accessibilityRole="button"
      accessibilityLabel={t({ th: `คัดลอก${props.what.th}`, en: `Copy the ${props.what.en}` })}
      hitSlop={8}
      style={styles.copy}
    >
      <LineIcon
        d={done ? ICON.check : ICON.copy}
        color={done ? theme.success : theme.text}
        size={16}
        strokeWidth={done ? 2.6 : 2}
      />
    </Pressable>
  );
}

const TICK_MS = 1500;

/** A row with its value in black on the right, and the copy mark when there is something to copy. */
export function ValueRow(props: {
  label: string;
  value: string | null;
  copy?: { what: Phrase; onCopied?: (said: Phrase) => void };
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Line
      label={props.label}
      last={props.last}
      onPress={props.onPress}
      right={
        <View style={styles.valueRight}>
          <Text style={[TYPE.body, styles.value, { color: theme.text }]} numberOfLines={1}>
            {props.value || "—"}
          </Text>
          {props.copy && props.value ? (
            <CopyIcon value={props.value} what={props.copy.what} onCopied={props.copy.onCopied} />
          ) : null}
          {props.right}
        </View>
      }
    />
  );
}

/**
 * A code box with its tools (copy, สุ่มให้): the label keeps its width and the box takes what is
 * left — a web text box is wide by default and would squeeze the label into a column.
 */
export function CodeInput(props: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  onChange: (v: string) => void;
  tools: ReactNode;
  last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <View style={styles.codeLine}>
        <Text style={[TYPE.body, styles.codeLabel, { color: theme.text }]}>{props.label}</Text>
        <TextInput
          value={props.value}
          onChangeText={props.onChange}
          placeholder={props.placeholder}
          placeholderTextColor={theme.textFaint}
          keyboardType={props.keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={props.label}
          style={[TYPE.body, styles.codeInput, { color: theme.text }]}
        />
        {props.tools}
      </View>
      {!props.last && <Divider />}
    </View>
  );
}

/** The ›, grey, at the end of a row that opens something. */
export function Chevron() {
  const { theme } = useTheme();
  return <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />;
}

/** A small round grey button with a line icon (the slip card's ⬇ and 📎). */
export function IconButton(props: { icon: string; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={[styles.iconButton, { backgroundColor: theme.hover }]}
    >
      <LineIcon d={props.icon} color={theme.text} size={18} strokeWidth={1.9} />
    </Pressable>
  );
}

/** A grey pill button on the right of a row (แนบสลิป, สุ่มให้). */
export function PillButton(props: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      style={[styles.pill, { backgroundColor: theme.hover }]}
    >
      <Text style={[TYPE.subhead, { color: theme.text }]}>{props.label}</Text>
    </Pressable>
  );
}

/**
 * The slip in its own card (owner's C, 2 Nov 2026): สลิป with ⬇ บันทึกรูป (and 📎 เปลี่ยนรูป while it
 * can still change), then the slip at the one size used everywhere, an even grey edge round it.
 */
export function SlipCard(props: {
  /** A picture already on the phone (a slip just attached). */
  uri?: string | null;
  /** Or one kept by the system. */
  path?: string | null;
  fileName: string;
  title?: string;
  change?: ReactNode;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const kept = useStaffImage(props.uri ? null : (props.path ?? null));
  const uri = props.uri ?? kept.uri;
  // The word sits on the card itself: in a sheet a page toast would be hidden under it.
  const [said, setSaid] = useState<Phrase | null>(null);
  useEffect(() => {
    if (!said) return;
    const timer = setTimeout(() => setSaid(null), SAID_MS);
    return () => clearTimeout(timer);
  }, [said]);
  const save = async () => {
    if (!uri) return;
    try {
      await saveImage(uri, props.fileName);
      setSaid({ th: "บันทึกรูปลงเครื่องแล้ว", en: "Saved to the phone" });
    } catch {
      setSaid({ th: "บันทึกรูปได้ในเวอร์ชันเว็บ", en: "Save it from the web version" });
    }
  };
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {said && (
        <View style={styles.said} accessibilityRole="alert" pointerEvents="none">
          <Text style={[TYPE.subhead, styles.saidText]}>{t(said)}</Text>
        </View>
      )}
      <View style={styles.cardHead}>
        <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>
          {props.title ?? t({ th: "สลิป", en: "Slip" })}
        </Text>
        <IconButton
          icon={STAFF_ICON.save}
          label={t({ th: "บันทึกรูป", en: "Save picture" })}
          onPress={() => void save()}
        />
        {props.change}
      </View>
      <View style={[styles.slipEdge, { backgroundColor: theme.bg }]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.slip}
            resizeMode="contain"
            accessibilityLabel={t({ th: "สลิป", en: "Slip" })}
          />
        ) : (
          <View style={[styles.slip, styles.center]}>
            {kept.failed ? (
              <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
                {t({ th: "เปิดรูปไม่ได้", en: "Could not open" })}
              </Text>
            ) : (
              <ActivityIndicator color={theme.textMuted} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/** Where a wage slip was, once the system has deleted it; the payslip itself stays. */
export function GoneCard({ note }: { note: Phrase }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.cardHead}>
        <Text style={[TYPE.body, { color: theme.text }]}>{t({ th: "สลิป", en: "Slip" })}</Text>
      </View>
      <View style={[styles.gone, { backgroundColor: theme.bg }]}>
        <Text style={[TYPE.headline, { color: theme.text }]}>
          {t({ th: "ลบรูปสลิปแล้ว", en: "Slip photo deleted" })}
        </Text>
        <Text style={[TYPE.subhead, styles.goneText, { color: theme.textMuted }]}>
          {t(note)}
          {"\n"}
          {t({ th: "ใบจ่ายเงินเดือนยังอยู่ครบ", en: "The payslip itself is all still here" })}
        </Text>
      </View>
    </View>
  );
}

/** The grey words under a card. */
export function Hint({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[TYPE.footnote, styles.hint, { color: theme.textMuted }]}>{text}</Text>;
}

/** The small grey heading over a run of rows (a day, a month). */
export function DayLabel({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[TYPE.footnote, styles.dayLabel, { color: theme.textMuted }]}>{text}</Text>;
}

const SLIP_RATIO = 1110 / 1691;
const SAID_MS = 2000;

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  codeLine: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  codeLabel: { flexShrink: 0 },
  codeInput: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
    paddingVertical: 0,
    outlineStyle: "none",
  } as never,
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  bandText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  copy: { width: 24, height: 34, alignItems: "center", justifyContent: "center" },
  valueRight: { flexDirection: "row", alignItems: "center", gap: SPACE.s, flexShrink: 1 },
  value: { flexShrink: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: { height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: "center" },
  card: { borderRadius: 12, overflow: "hidden" },
  said: {
    position: "absolute",
    top: 58,
    left: SPACE.l,
    right: SPACE.l,
    zIndex: 2,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "rgba(28,28,30,0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.m,
  },
  saidText: { color: "#FFFFFF", fontWeight: "600" },
  cardHead: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  grow: { flex: 1, minWidth: 0 },
  slipEdge: { marginHorizontal: SPACE.l, marginBottom: SPACE.l, padding: 12, borderRadius: 12 },
  slip: { width: "100%", aspectRatio: SLIP_RATIO, borderRadius: 6 },
  center: { alignItems: "center", justifyContent: "center" },
  gone: {
    marginHorizontal: SPACE.l,
    marginBottom: SPACE.l,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.l,
    borderRadius: 12,
    alignItems: "center",
    gap: SPACE.xs,
  },
  goneText: { textAlign: "center" },
  hint: { marginTop: SPACE.s, marginHorizontal: SPACE.l },
  dayLabel: { marginTop: SPACE.l, marginBottom: SPACE.s, marginHorizontal: 2 },
});
