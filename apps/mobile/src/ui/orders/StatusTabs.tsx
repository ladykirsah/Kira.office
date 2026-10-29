import type { Phrase } from "@l-shopee/shared/lang";
import { useEffect, useRef, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { ALL_TAB_LABEL, ORDER_TABS, type OrderTab } from "@/lib/orderList";
import { useLang, useTheme } from "../AppProviders";
import { SPACE, TYPE } from "../theme";

interface StatusTabsProps {
  value: OrderTab | "all";
  counts: Record<OrderTab | "all", number>;
  onPick: (tab: OrderTab | "all") => void;
}

const TABS: readonly { key: OrderTab | "all"; label: Phrase }[] = [
  { key: "all", label: ALL_TAB_LABEL },
  ...ORDER_TABS.map((tab) => ({ key: tab.key, label: tab.label })),
];

/**
 * Choice B's status tabs: one row that scrolls sideways, every tab with its count, one tap changes
 * the list. The picked tab slides to the front so it stays in sight.
 */
export function StatusTabs({ value, counts, onPick }: StatusTabsProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const row = useRef<ComponentRef<typeof ScrollView>>(null);
  const xs = useRef<Partial<Record<OrderTab | "all", number>>>({});

  useEffect(() => {
    row.current?.scrollTo({ x: Math.max(0, (xs.current[value] ?? 0) - SPACE.l), animated: true });
  }, [value]);

  return (
    <ScrollView
      ref={row}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={styles.strip}
      contentContainerStyle={styles.row}
    >
      {TABS.map((tab) => {
        const on = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onPick(tab.key)}
            onLayout={(e) => {
              xs.current[tab.key] = e.nativeEvent.layout.x;
            }}
            accessibilityRole="tab"
            accessibilityLabel={`${t(tab.label)} ${counts[tab.key]}`}
            accessibilityState={{ selected: on }}
            style={[
              styles.tab,
              {
                backgroundColor: theme.surface,
                borderColor: on ? theme.primary : theme.border,
                borderWidth: on ? 1.5 : 1,
              },
            ]}
          >
            <Text
              style={[styles.text, { color: on ? theme.primary : theme.text }, on && styles.on]}
            >
              {t(tab.label)}{" "}
              <Text style={{ color: on ? theme.primary : theme.textMuted }}>{counts[tab.key]}</Text>
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // The row runs to the screen's right edge, so a cut-off tab says "there is more".
  strip: { marginTop: SPACE.l, marginRight: -SPACE.l, flexGrow: 0 },
  row: { gap: SPACE.s, paddingRight: SPACE.l },
  tab: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center" },
  text: { ...TYPE.subhead },
  on: { fontWeight: "600" },
});
