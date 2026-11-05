import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { SPACE, TYPE } from "../theme";

export interface TableColumn<T> {
  key: string;
  /** The grey heading; "" for a photo column. */
  label: string;
  /** A fixed width, or none to share the room left (the name column). */
  width?: number;
  /** Numbers and money sit on the right (guide). */
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** A row that opens something: the whole row is the button, with a › at its end. */
  onPress?: (row: T) => void;
  /** What a screen reader says for the row. */
  rowLabel?: (row: T) => string;
  /** Row height at least (guide: 60; 68 with a 48 photo). */
  minRowHeight?: number;
  /** No heading row (a short list whose cells say what they are). */
  noHead?: boolean;
}

const CHEVRON = "M9 5l7 7-7 7";

/**
 * A computer list (computer guide C · Mercury): grey headings, one thin line between rows, numbers on
 * the right, the whole row opens its page. Sits inside a DeskCard with pad 4.
 */
export function Table<T>(props: TableProps<T>) {
  const { theme } = useTheme();
  const tail = props.onPress ? <View style={styles.chevronCell} /> : null;
  return (
    <View>
      {!props.noHead && (
        <View style={[styles.row, styles.head, { borderBottomColor: theme.border }]}>
          {props.columns.map((c) => (
            <View key={c.key} style={cellBox(c)}>
              <Text
                style={[TYPE.footnote, { color: theme.textMuted, textAlign: c.align ?? "left" }]}
                numberOfLines={1}
              >
                {c.label}
              </Text>
            </View>
          ))}
          {tail}
        </View>
      )}
      {props.rows.map((row, i) => {
        const last = i === props.rows.length - 1;
        const body = (
          <>
            {props.columns.map((c) => (
              <View key={c.key} style={[cellBox(c), c.align === "right" && styles.right]}>
                {c.cell(row)}
              </View>
            ))}
            {props.onPress && (
              <View style={styles.chevronCell}>
                <LineIcon d={CHEVRON} color={theme.textFaint} size={14} strokeWidth={2.4} />
              </View>
            )}
          </>
        );
        const line = !last && { borderBottomWidth: 1, borderBottomColor: theme.border };
        const height = { minHeight: props.minRowHeight ?? 60 };
        if (!props.onPress) {
          return (
            <View key={props.rowKey(row)} style={[styles.row, styles.body, height, line]}>
              {body}
            </View>
          );
        }
        const open = props.onPress;
        return (
          <Pressable
            key={props.rowKey(row)}
            onPress={() => open(row)}
            // A link, not a button: a row may hold its own buttons (a code's copy mark), and the
            // web allows no button inside a button.
            accessibilityRole="link"
            accessibilityLabel={props.rowLabel?.(row)}
            style={(state) => [
              styles.row,
              styles.body,
              height,
              line,
              // A row lights up under the mouse (react-native-web's hovered), and while pressed.
              ((state as { hovered?: boolean }).hovered || state.pressed) && {
                backgroundColor: theme.sideOn,
              },
            ]}
          >
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}

const cellBox = (c: { width?: number }) =>
  c.width !== undefined ? { width: c.width, flexShrink: 0 } : styles.grow;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xl,
    paddingHorizontal: SPACE.l,
  },
  head: { height: 36, borderBottomWidth: 1 },
  body: { paddingVertical: SPACE.s, borderRadius: 10 },
  grow: { flex: 1, minWidth: 0 },
  right: { alignItems: "flex-end" },
  chevronCell: { width: 14, alignItems: "flex-end" },
});
