import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { Divider } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { Avatar, Chevron } from "./parts";

export interface PickRow {
  id: string;
  name: string;
  sub: string;
  /** False: shown, but it can't be picked (a month already paid). */
  open?: boolean;
}

/**
 * เลือกคน (canvas v292, 2.2 · 2.4 · 2.14 · 6.4): each person with what matters for the record — their
 * position, what the month owes, how much was advanced. `chosen` ticks the current one red.
 */
export function PickPersonSheet(props: {
  title: string;
  heading?: string;
  rows: readonly PickRow[];
  chosen?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <Sheet title={props.title} onClose={props.onClose}>
      {props.heading ? (
        <Text style={[TYPE.subhead, styles.heading, { color: theme.text }]}>{props.heading}</Text>
      ) : null}
      <Group>
        {props.rows.length === 0 && (
          <Text style={[TYPE.subhead, styles.none, { color: theme.textMuted }]}>
            {t({ th: "ยังไม่มีใครมีค่าแรงต่อวัน", en: "Nobody has a day rate yet" })}
          </Text>
        )}
        {props.rows.map((r, i) => {
          const open = r.open !== false;
          return (
            <View key={r.id}>
              <Pressable
                onPress={() => open && props.onPick(r.id)}
                disabled={!open}
                accessibilityRole="button"
                accessibilityState={{ disabled: !open, selected: r.id === props.chosen }}
                style={styles.row}
              >
                <Avatar name={r.name} size={36} />
                <View style={styles.grow}>
                  <Text style={[TYPE.body, styles.name, { color: theme.text }]}>{r.name}</Text>
                  <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{r.sub}</Text>
                </View>
                {r.id === props.chosen ? (
                  <LineIcon d={ICON.check} color={theme.primary} size={18} strokeWidth={2.6} />
                ) : open && props.chosen == null ? (
                  <Chevron />
                ) : null}
              </Pressable>
              {i < props.rows.length - 1 && <Divider />}
            </View>
          );
        })}
      </Group>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: "600", marginHorizontal: SPACE.xs },
  row: {
    minHeight: 60,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.s,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  grow: { flex: 1, minWidth: 0 },
  name: { fontWeight: "600" },
  none: { padding: SPACE.l },
});
