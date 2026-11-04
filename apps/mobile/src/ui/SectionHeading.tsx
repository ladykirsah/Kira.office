import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "./AppProviders";
import { SPACE, TYPE } from "./theme";

/** A section's 22-bold heading with an optional red link on its right (ภาพรวม AirPlus's ดูทั้งหมด). */
export function SectionHeading(props: {
  title: string;
  more?: { label: string; onPress: () => void };
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.heading}>
      <Text style={[TYPE.title2, styles.grow, { color: theme.text }]} accessibilityRole="header">
        {props.title}
      </Text>
      {props.more && (
        <Pressable onPress={props.more.onPress} accessibilityRole="link" hitSlop={8}>
          <Text style={[TYPE.body, { color: theme.primary }]}>{props.more.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: SPACE.xxl,
    marginBottom: SPACE.m,
    marginHorizontal: 2,
  },
  grow: { flex: 1 },
});
