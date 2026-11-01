import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../AppProviders";
import { TYPE } from "../theme";

/**
 * The grey pill a picked day or time sits in, in the app's own font, as the drawings show it
 * ("1 ต.ค. 2569", "00:00"). On the web the browser's own date or time box lies over it unseen, so
 * a tap still opens the phone's wheel (`children`).
 */
export function PickerPill({ text, children }: { text: string; children?: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.segBg }]}>
      <Text
        style={[TYPE.body, styles.text, { color: text === "—" ? theme.textMuted : theme.text }]}
      >
        {text}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 8,
    justifyContent: "center",
    alignSelf: "center",
    overflow: "hidden",
  },
  text: { fontVariant: ["tabular-nums"] },
});
