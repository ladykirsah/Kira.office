import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "./AppProviders";
import { LineIcon } from "./LineIcon";
import { TYPE } from "./theme";

interface BigButtonProps {
  label: string;
  onPress: () => void;
  kind?: "red" | "grey";
  /** A small icon before the words; one SVG path on a 24-unit grid. */
  icon?: string;
}

/**
 * The guide's 50-high pill button. Red is the screen's one main action; grey is the quiet one beside
 * it. Never greyed out to mean "not now" — a button that cannot act says why when tapped.
 */
export function BigButton({ label, onPress, kind = "red", icon }: BigButtonProps) {
  const { theme } = useTheme();
  const red = kind === "red";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: red
            ? pressed
              ? theme.primaryPressed
              : theme.button
            : pressed
              ? theme.border
              : theme.hover,
        },
      ]}
    >
      {icon ? (
        <LineIcon d={icon} color={red ? theme.onPrimary : theme.text} size={20} strokeWidth={2.2} />
      ) : null}
      <Text style={[styles.label, { color: red ? theme.onPrimary : theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  label: { ...TYPE.headline },
});
