import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "./AppProviders";
import { LineIcon } from "./LineIcon";
import { TYPE } from "./theme";

interface BigButtonProps {
  label: string;
  onPress: () => void;
  kind?: "red" | "grey" | "dark";
  /** A small icon before the words; one SVG path on a 24-unit grid. */
  icon?: string;
}

/**
 * The guide's 50-high pill button. Red is the screen's one main action; grey is the quiet one beside
 * it; dark (graphite) opens another page from a page with no red action (หน้าหลัก's ดูภาพรวม AirPlus).
 * Never greyed out to mean "not now" — a button that cannot act says why when tapped.
 */
export function BigButton({ label, onPress, kind = "red", icon }: BigButtonProps) {
  const { theme } = useTheme();
  const light = kind !== "grey";
  const fill = (pressed: boolean) => {
    if (kind === "red") return pressed ? theme.primaryPressed : theme.button;
    if (kind === "dark") return theme.graphite;
    return pressed ? theme.border : theme.hover;
  };
  const ink = light ? theme.onPrimary : theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fill(pressed), opacity: kind === "dark" && pressed ? 0.85 : 1 },
      ]}
    >
      {icon ? <LineIcon d={icon} color={ink} size={20} strokeWidth={2.2} /> : null}
      <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
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
