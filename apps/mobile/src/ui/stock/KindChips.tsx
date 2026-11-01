import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { MOVEMENT_KINDS, type MovementKind } from "@/lib/stockHistory";
import { useLang, useTheme } from "../AppProviders";
import { SPACE, TYPE } from "../theme";

/**
 * The type buttons, the Orders status tabs' look without counts (as drawn): one row that scrolls
 * sideways to the screen's edge; the chosen one has a red outline and red words.
 */
export function KindChips(props: { value: MovementKind; onPick: (kind: MovementKind) => void }) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={styles.strip}
      contentContainerStyle={styles.row}
    >
      {MOVEMENT_KINDS.map((kind) => {
        const on = kind.key === props.value;
        return (
          <Pressable
            key={kind.key}
            onPress={() => props.onPick(kind.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[
              styles.chip,
              {
                backgroundColor: theme.surface,
                borderColor: on ? theme.primary : theme.border,
                borderWidth: on ? 1.5 : 1,
              },
            ]}
          >
            <Text
              style={[TYPE.subhead, { color: on ? theme.primary : theme.text }, on && styles.on]}
            >
              {t(kind.label)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { marginTop: SPACE.m, marginRight: -SPACE.l, flexGrow: 0 },
  row: { gap: SPACE.s, paddingRight: SPACE.l },
  chip: { height: 32, paddingHorizontal: SPACE.m, borderRadius: 16, justifyContent: "center" },
  on: { fontWeight: "600" },
});
