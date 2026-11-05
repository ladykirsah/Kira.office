import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../AppProviders";
import { SPACE, TYPE } from "../theme";

interface DeskCardProps {
  /** The card's name, top left (ต้องจัดการ, อัปเดตใน Shopee). */
  title?: string;
  /** A quiet link top right (ดูออเดอร์). */
  action?: { label: string; onPress: () => void };
  /** Inner padding: 20, or 4 for a table that runs edge to edge. */
  pad?: number;
  /** Share of a row it sits in (two cards side by side). */
  flex?: number;
  children: ReactNode;
}

/** A white card with a thin line (computer guide C · Mercury): a title row, then its body. */
export function DeskCard({ title, action, pad = 20, flex, children }: DeskCardProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { padding: pad, backgroundColor: theme.surface, borderColor: theme.border },
        flex !== undefined && { flex, minWidth: 0 },
      ]}
    >
      {(title || action) && (
        <View style={[styles.head, pad < SPACE.l && styles.headInset]}>
          <Text style={[TYPE.headline, styles.title, { color: theme.text }]}>{title}</Text>
          {action && (
            <Pressable onPress={action.onPress} accessibilityRole="link" hitSlop={8}>
              <Text style={[TYPE.subhead, { color: theme.primary }]}>{action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginBottom: SPACE.m },
  headInset: { paddingHorizontal: SPACE.l, paddingTop: SPACE.m },
  title: { flex: 1 },
});
