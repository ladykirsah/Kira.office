import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "./AppProviders";

interface SegmentedProps<T extends string> {
  /** What the choice is about, for screen readers. */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** The guide's segmented control: one row of choices, the chosen one lifted onto a white pill. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  const { theme } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: theme.segBg }]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[
              styles.segment,
              on && { backgroundColor: theme.segOn, boxShadow: "0 2px 6px rgba(0,0,0,0.10)" },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.text, { color: theme.text, fontWeight: on ? "600" : "500" }]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 2, borderRadius: 10 },
  segment: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  text: { fontSize: 13, lineHeight: 18 },
});
