import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { SPACE, TYPE } from "../theme";

/** A label on the left (96 wide) and what is typed on the right — the Apple form row. */
export function FieldRow(props: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
  onBlur?: () => void;
  keyboardType?: KeyboardTypeOptions;
  error?: string | null;
  last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.text }]}>{props.label}</Text>
        <TextInput
          value={props.value}
          onChangeText={props.onChange}
          onBlur={props.onBlur}
          onSubmitEditing={props.onBlur}
          placeholder={props.placeholder}
          placeholderTextColor={theme.textFaint}
          keyboardType={props.keyboardType}
          accessibilityLabel={props.label}
          style={[styles.input, { color: theme.text }]}
        />
      </View>
      {props.error ? <FieldError text={props.error} /> : null}
      {!props.last && <Divider />}
    </View>
  );
}

/** The hairline under a row; it starts where the text starts, never full width (owner rule). */
function Divider() {
  const { theme } = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

/** A row that opens a choice: label, its value in grey, ›. Red words when it is an action. */
export function ChoiceRow(props: {
  label: string;
  value?: string;
  sub?: string;
  onPress: () => void;
  action?: boolean;
  error?: string | null;
  last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <Pressable onPress={props.onPress} accessibilityRole="button" style={styles.row}>
        <View style={styles.labels}>
          <Text style={[TYPE.body, { color: props.action ? theme.primary : theme.text }]}>
            {props.label}
          </Text>
          {props.sub ? (
            <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
              {props.sub}
            </Text>
          ) : null}
        </View>
        {props.value ? (
          <Text style={[TYPE.body, styles.value, { color: theme.textMuted }]} numberOfLines={1}>
            {props.value}
          </Text>
        ) : null}
        {!props.action && (
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        )}
      </Pressable>
      {props.error ? <FieldError text={props.error} /> : null}
      {!props.last && <Divider />}
    </View>
  );
}

/** What is missing, said in red right under the field (the guide: never a greyed-out button). */
export function FieldError({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.error} accessibilityRole="alert">
      <LineIcon d={ICON.alert} color={theme.danger} size={15} strokeWidth={2.4} />
      <Text style={[TYPE.footnote, { color: theme.danger, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** A grey note under a card. */
export function Note({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>{children}</Text>;
}

/** A section heading with room for a thing on the right. */
export function Heading({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[TYPE.title2, styles.heading, { color: theme.text }]} accessibilityRole="header">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: SPACE.l },
  label: { ...TYPE.subhead, width: 96 },
  input: { ...TYPE.body, flex: 1, minWidth: 0, paddingVertical: 12, outlineStyle: "none" } as never,
  labels: { flex: 1, minWidth: 0, paddingVertical: 10 },
  value: { flexShrink: 1, textAlign: "right" },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACE.l,
    paddingBottom: 10,
  },
  note: { marginTop: SPACE.s, marginHorizontal: SPACE.xs },
  heading: { marginTop: SPACE.xxl, marginBottom: SPACE.m, marginHorizontal: 2 },
});
