import { useState, type ReactNode } from "react";
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
import { Divider, DOWN } from "./parts";

/**
 * A computer form's boxes (DeskAddProduct board, 4 Nov 2026; computer guide · forms): the name in
 * grey over a white box with a thin line; the line turns red, a little thicker, on a box that needs
 * fixing, and what is wrong is said in red under it. A value that can't be typed is plain black.
 * The name and code sit as label-over-box; every other field is a row, name left and box right (A2).
 */

const BOX_HEIGHT = 40;
/** A typed box at a row's end (A2): wide enough for "1,450 บาท". */
const LINE_BOX = 150;
/** A pick box at a row's end. */
const LINE_PICK = 170;

/** The grey name over a box. */
function Label({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[TYPE.footnote, styles.label, { color: theme.textMuted }]} numberOfLines={1}>
      {text}
    </Text>
  );
}

/** A box's look: white, a thin line, red when it needs fixing. */
function useBoxStyle(red?: boolean) {
  const { theme } = useTheme();
  return [
    styles.box,
    {
      backgroundColor: theme.surface,
      borderColor: red ? theme.danger : theme.border,
      borderWidth: red ? 1.5 : 1,
    },
  ];
}

/** The name and code at the top of the form: a grey name over a box (A2). */
export function BoxField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** An icon button at the box's end (scan). */
  tool?: ReactNode;
  /** The box needs fixing. */
  red?: boolean;
  /** A long value wraps onto more lines; Enter adds a space (a product name is one line of words). */
  wraps?: boolean;
  /** Under the box: what is wrong, a link. */
  below?: ReactNode;
}) {
  const { theme } = useTheme();
  const box = useBoxStyle(props.red);
  const [height, setHeight] = useState<number>();
  return (
    <View style={styles.field}>
      <Label text={props.label} />
      <View style={box}>
        <TextInput
          value={props.value}
          onChangeText={(v) => props.onChange(props.wraps ? v.replace(/\n/g, " ") : v)}
          placeholder={props.placeholder}
          placeholderTextColor={theme.textFaint}
          accessibilityLabel={props.label}
          multiline={props.wraps}
          onContentSizeChange={
            props.wraps ? (e) => setHeight(e.nativeEvent.contentSize.height) : undefined
          }
          style={[
            styles.input,
            { color: theme.text },
            props.wraps && { height: Math.max(height ?? 0, TYPE.subhead.lineHeight) },
          ]}
        />
        {props.tool}
      </View>
      {props.below}
    </View>
  );
}

/** One small box of ขนาดกล่อง (กว้าง, ยาว, สูง). */
export function SideBox(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  said: string;
  red?: boolean;
}) {
  const { theme } = useTheme();
  const box = useBoxStyle(props.red);
  return (
    <View style={[box, styles.side]}>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        keyboardType="decimal-pad"
        placeholder={props.placeholder}
        placeholderTextColor={theme.textFaint}
        accessibilityLabel={props.said}
        style={[styles.input, styles.sideInput, { color: theme.text }]}
      />
    </View>
  );
}

/**
 * A row of a computer form card (A2, owner 5 Nov 2026 — the form reads like its product page): the
 * field's name on the left, its box on the right, what is wrong under the row.
 */
export function FieldLine(props: {
  label: string;
  children: ReactNode;
  below?: ReactNode;
  last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <View style={styles.line}>
        <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{props.label}</Text>
        {props.children}
      </View>
      {props.below ? <View style={styles.lineBelow}>{props.below}</View> : null}
      {!props.last && <Divider />}
    </View>
  );
}

/** A typed box at a row's end: the value on the right, its unit in grey after it ("บาท", "กก."). */
export function LineBox(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
  red?: boolean;
  /** The typed value itself is red (a price under cost). */
  valueRed?: boolean;
  keyboardType?: KeyboardTypeOptions;
  /** False: the value as plain words (a price only the owner may change). */
  editable?: boolean;
  width?: number;
}) {
  const { theme } = useTheme();
  const box = useBoxStyle(props.red);
  const color = props.valueRed ? theme.danger : theme.text;
  const unit = props.unit ? (
    <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{props.unit}</Text>
  ) : null;
  if (props.editable === false) {
    return (
      <View style={styles.plain}>
        <Text style={[TYPE.subhead, styles.fixed, { color }]}>{props.value || "—"}</Text>
        {props.value ? unit : null}
      </View>
    );
  }
  return (
    <View style={[box, styles.lineBox, { width: props.width ?? LINE_BOX }]}>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={theme.textFaint}
        keyboardType={props.keyboardType}
        accessibilityLabel={props.label}
        style={[styles.input, styles.right, { color }]}
      />
      {unit}
    </View>
  );
}

/** A box at a row's end that opens a pick list (ยี่ห้ออะไหล่, ระบบรถ, ชื่ออะไหล่): the choice, then ⌄. */
export function LinePick(props: {
  label: string;
  value: string | null;
  hint: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const box = useBoxStyle();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${props.label}: ${props.value ?? props.hint}`}
      style={[box, styles.linePick]}
    >
      <Text
        style={[styles.input, { color: props.value ? theme.text : theme.textFaint }]}
        numberOfLines={1}
      >
        {props.value ?? props.hint}
      </Text>
      <LineIcon d={DOWN} color={theme.textMuted} size={14} strokeWidth={2.2} />
    </Pressable>
  );
}

/** A plain value at a row's end (ต้นทุนรวม), or a few small boxes (ขนาดกล่อง). */
export function LinePlain({ children }: { children: ReactNode }) {
  return <View style={styles.plain}>{children}</View>;
}

/** The product's own words (รายละเอียด): a box that grows with them. */
export function TextBox(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { theme } = useTheme();
  const box = useBoxStyle();
  return (
    <View style={[box, styles.textBox]}>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={theme.textFaint}
        accessibilityLabel={props.label}
        multiline
        style={[styles.input, styles.text, { color: theme.text }]}
      />
    </View>
  );
}

/** What is wrong with a box, in red right under it. */
export function BoxError({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.error} accessibilityRole="alert">
      <LineIcon d={ICON.alert} color={theme.danger} size={14} strokeWidth={2.4} />
      <Text style={[TYPE.footnote, styles.grow, { color: theme.danger }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  field: { gap: 6, minWidth: 0 },
  label: { marginLeft: 2 },
  box: {
    minHeight: BOX_HEIGHT,
    borderRadius: 10,
    paddingHorizontal: SPACE.m,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  input: {
    ...TYPE.subhead,
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    outlineStyle: "none",
  } as never,
  fixed: { fontVariant: ["tabular-nums"] },
  plain: { minHeight: BOX_HEIGHT, flexDirection: "row", alignItems: "center", gap: 6 },
  side: { width: 48, paddingHorizontal: 4 },
  sideInput: { textAlign: "center" },
  error: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  line: {
    minHeight: 56,
    paddingHorizontal: SPACE.l,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  lineBelow: { paddingHorizontal: SPACE.l, paddingBottom: 10, marginTop: -4 },
  lineBox: { flexShrink: 1, minWidth: 96, paddingVertical: 6 },
  right: { textAlign: "right" },
  linePick: { width: LINE_PICK, flexShrink: 1, minWidth: 110, paddingVertical: 6 },
  textBox: { alignItems: "flex-start" },
  text: { minHeight: 72, textAlignVertical: "top" },
});
