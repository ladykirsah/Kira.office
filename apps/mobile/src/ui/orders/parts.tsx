import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { RADIUS, SPACE, TYPE, type Theme } from "../theme";
import { ICON } from "./icons";

/** A white rounded group of rows (Apple's grouped list); `spaced` when it follows another one. */
export function Group({ children, spaced }: { children: ReactNode; spaced?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.group, spaced && styles.spaced, { backgroundColor: theme.surface }]}>
      {children}
    </View>
  );
}

/** The 22-bold heading above a section. */
export function SectionTitle({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[styles.section, { color: theme.text }]} accessibilityRole="header">
      {text}
    </Text>
  );
}

export interface RowProps {
  label: string;
  value?: string;
  /** A grey line under the label. */
  sub?: string;
  bold?: boolean;
  last?: boolean;
  /** The value is a link (a phone number to call). */
  valueLink?: boolean;
  /** The whole row is a link with a chevron (open the carrier's tracking page). */
  onPress?: () => void;
  /** With onPress: the row opens a page of the app's own (a ›), so its label stays black. */
  opens?: boolean;
  /** A small round button on the right (copy). */
  tool?: { label: string; icon: string; onPress: () => void };
}

/** A label on the left, its value grey on the right; bold for a total. */
export function Row(props: RowProps) {
  const { theme } = useTheme();
  const s = rowStyles(theme);
  const body = (
    <View style={[s.row, props.sub ? s.twoLine : null, !props.last && s.divider]}>
      <View style={s.labels}>
        <Text
          style={[
            s.label,
            props.bold && s.bold,
            props.onPress && !props.valueLink && !props.opens && { color: theme.primary },
          ]}
        >
          {props.label}
        </Text>
        {props.sub ? <Text style={s.sub}>{props.sub}</Text> : null}
      </View>
      {props.value ? (
        <Text
          style={[
            s.value,
            props.bold && [s.bold, { color: theme.text }],
            props.valueLink && { color: theme.primary },
          ]}
        >
          {props.value}
        </Text>
      ) : null}
      {props.tool && (
        <Pressable
          onPress={props.tool.onPress}
          accessibilityRole="button"
          accessibilityLabel={props.tool.label}
          hitSlop={6}
          style={s.tool}
        >
          <LineIcon d={props.tool.icon} color={theme.text} size={15} strokeWidth={2.2} />
        </Pressable>
      )}
      {props.onPress && !props.valueLink && (
        <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
      )}
    </View>
  );
  return props.onPress ? (
    <Pressable
      onPress={props.onPress}
      accessibilityRole={props.opens ? "button" : "link"}
      accessibilityLabel={props.opens ? props.label : undefined}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** The guide's small button (34 high, with a 44 tap area). */
export function SmallButton(props: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      hitSlop={5}
      style={({ pressed }) => [
        styles.small,
        { backgroundColor: pressed ? theme.border : theme.hover },
      ]}
    >
      <Text style={[styles.smallText, { color: theme.text }]}>{props.label}</Text>
    </Pressable>
  );
}

/** The white box at the top of the page that holds the one job waiting on the shop. */
export function JobBox({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return <View style={[styles.job, { backgroundColor: theme.surface }]}>{children}</View>;
}

/** The job box's heading: a coloured round icon and a name, optionally with tools on the right. */
export function JobHead(props: { icon: string; color: string; title: string; right?: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.jobHead}>
      <View style={[styles.dot, { backgroundColor: props.color }]}>
        <LineIcon d={props.icon} color="#FFFFFF" size={16} strokeWidth={2.4} />
      </View>
      <Text style={[styles.jobTitle, { color: theme.text }]}>{props.title}</Text>
      {props.right}
    </View>
  );
}

/** Body text in a job box: black for what happened, grey (small) for what follows from it. */
export function Say(props: { text: string; quiet?: boolean; small?: boolean; center?: boolean }) {
  const { theme } = useTheme();
  return (
    <Text
      style={[
        props.small ? styles.small13 : styles.say,
        { color: props.quiet ? theme.textMuted : theme.text },
        props.center && { textAlign: "center" },
      ]}
    >
      {props.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: RADIUS.card, overflow: "hidden" },
  spaced: { marginTop: SPACE.m },
  section: { ...TYPE.title2, marginTop: SPACE.xxl, marginBottom: SPACE.m, marginHorizontal: 2 },
  small: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  smallText: { ...TYPE.subhead },
  job: { borderRadius: RADIUS.card, padding: SPACE.l, gap: SPACE.m },
  jobHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  jobTitle: { ...TYPE.headline, flex: 1 },
  say: { ...TYPE.subhead },
  small13: { ...TYPE.footnote },
});

const rowStyles = (c: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: 52,
      marginLeft: SPACE.l,
      paddingVertical: 10,
      paddingRight: SPACE.l,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    /** The guide's row heights: 52 for one line, 68 with a grey second line. */
    twoLine: { minHeight: 68 },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    labels: { flex: 1, minWidth: 0 },
    label: { ...TYPE.body, color: c.text },
    bold: { fontWeight: "600" },
    sub: { ...TYPE.footnote, color: c.textMuted },
    value: { ...TYPE.body, color: c.textMuted, fontVariant: ["tabular-nums"], textAlign: "right" },
    tool: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.hover,
      alignItems: "center",
      justifyContent: "center",
    },
  });
