import { useEffect, useRef, type ComponentRef, type ReactNode } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { API_BASE } from "@/lib/config";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { RADIUS, SPACE, TYPE } from "../theme";

/** The pieces สินค้า's screens share (canvas v194), each drawn as the approved pages draw it. */

export const DOWN = "M7 10l5 5 5-5";
export const UP = "M7 14l5-5 5 5";
export const SORT_ICON = "M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4";

/** A product photo on its grey ground; grey with nothing on it when there is no photo yet. */
export function Photo({
  imageKey,
  size,
  radius = RADIUS.thumb,
}: {
  imageKey: string | null;
  size: number;
  radius?: number;
}) {
  const { theme } = useTheme();
  const box = { width: size, height: size, borderRadius: radius, backgroundColor: theme.hover };
  if (!imageKey) return <View style={box} />;
  return <Image source={{ uri: `${API_BASE}/img/${imageKey}` }} style={box} />;
}

/** The grey search field, without the page margin of ลูกค้า's. */
export function SearchBox(props: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  /** Beside other tools in a row (the list's scan and sort), it takes the room left. */
  grow?: boolean;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <View style={[styles.search, props.grow && styles.grow, { backgroundColor: theme.segBg }]}>
      <LineIcon d={ICON.search} color={theme.textMuted} size={17} strokeWidth={2} />
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={props.placeholder}
        autoCorrect={false}
        style={[TYPE.body, styles.searchInput, { color: theme.text }]}
      />
      {props.value !== "" && (
        <Pressable
          onPress={() => props.onChange("")}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ล้างคำค้น", en: "Clear search" })}
          hitSlop={8}
        >
          <LineIcon d={ICON.close} color={theme.textMuted} size={15} strokeWidth={2.4} />
        </Pressable>
      )}
    </View>
  );
}

/** A round grey tool beside the search field (สแกน, เรียงตาม). */
export function RoundTool(props: { icon: string; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={[styles.tool, { backgroundColor: theme.segBg }]}
    >
      <LineIcon d={props.icon} color={theme.text} size={19} strokeWidth={2} />
    </Pressable>
  );
}

/** Text tabs with counts; the chosen one is black and bold over a black line (as drawn). */
export function UnderlineTabs<K extends string>(props: {
  tabs: readonly { key: K; label: string }[];
  counts: Record<K, number>;
  value: K;
  onPick: (key: K) => void;
}) {
  const { theme } = useTheme();
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const xs = useRef<Partial<Record<K, number>>>({});
  // The picked tab slides into sight, as on Orders.
  useEffect(() => {
    strip.current?.scrollTo({
      x: Math.max(0, (xs.current[props.value] ?? 0) - SPACE.l),
      animated: true,
    });
  }, [props.value]);
  return (
    <View style={styles.tabsWrap}>
      <ScrollView
        ref={strip}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.tabs}
      >
        {props.tabs.map((tab) => {
          const on = tab.key === props.value;
          return (
            <Pressable
              key={tab.key}
              onLayout={(e) => {
                xs.current[tab.key] = e.nativeEvent.layout.x;
              }}
              onPress={() => props.onPick(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && { borderBottomColor: theme.text }]}
            >
              <Text
                style={[
                  TYPE.subhead,
                  on ? styles.tabOn : null,
                  { color: on ? theme.text : theme.textMuted },
                ]}
              >
                {tab.label}{" "}
                <Text style={{ color: theme.textMuted, fontWeight: "400" }}>
                  {props.counts[tab.key]}
                </Text>
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** A filter chip: "ยี่ห้อ ⌄", black with its choice once one is picked. */
export function Chip(props: { label: string; on: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const fg = props.on ? theme.bg : theme.text;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      style={[styles.chip, { backgroundColor: props.on ? theme.text : theme.segBg }]}
    >
      <Text style={[TYPE.subhead, { color: fg }]} numberOfLines={1}>
        {props.label}
      </Text>
      <LineIcon d={DOWN} color={fg} size={13} strokeWidth={2.6} />
    </Pressable>
  );
}

/** − n + . Never below 0. */
export function Stepper(props: { value: number; label: string; onChange: (n: number) => void }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const button = (sign: string, said: string, next: number) => (
    <Pressable
      onPress={() => props.onChange(Math.max(0, next))}
      accessibilityRole="button"
      accessibilityLabel={`${said} ${props.label}`}
      hitSlop={6}
      style={[styles.step, { backgroundColor: theme.hover }]}
    >
      <Text style={[styles.stepSign, { color: theme.text }]}>{sign}</Text>
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {button("−", t({ th: "ลด", en: "Less" }), props.value - 1)}
      <Text style={[TYPE.body, styles.stepValue, { color: theme.text }]}>{props.value}</Text>
      {button("+", t({ th: "เพิ่ม", en: "More" }), props.value + 1)}
    </View>
  );
}

/** The hairline under a row, starting where the text starts. */
export function Divider() {
  const { theme } = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

/** A row of a white group: label on the left, anything on the right. */
export function Line(props: {
  label: string;
  right?: ReactNode;
  last?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const body = (
    <View style={styles.line}>
      <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{props.label}</Text>
      {props.right}
    </View>
  );
  return (
    <View>
      {props.onPress ? (
        <Pressable onPress={props.onPress} accessibilityRole="button">
          {body}
        </Pressable>
      ) : (
        body
      )}
      {!props.last && <Divider />}
    </View>
  );
}

/** A choice in a pick sheet: the name, how many have it, the red ✓ when chosen, or › to go on. */
export function PickRow(props: {
  label: string;
  count?: number;
  sub?: string;
  checked?: boolean;
  opens?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Line
      label={props.label}
      last={props.last}
      onPress={props.onPress}
      right={
        <View style={styles.pickRight}>
          {props.sub ? (
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{props.sub}</Text>
          ) : null}
          {props.count != null && (
            <Text style={[TYPE.subhead, styles.count, { color: theme.textMuted }]}>
              {props.count}
            </Text>
          )}
          <View style={styles.tick}>
            {props.checked ? (
              <LineIcon d={ICON.check} color={theme.primary} size={18} strokeWidth={2.6} />
            ) : props.opens ? (
              <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
            ) : null}
          </View>
        </View>
      }
    />
  );
}

/** "＋ เพิ่ม…ใหม่" at the end of a pick list. */
export function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.line}>
      <LineIcon d={ICON.plus} color={theme.text} size={16} strokeWidth={2.2} />
      <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

/** A typed value on the right of its label, with its unit after it ("บาท", "กก."). */
export function InputRow(props: {
  label: string;
  value: string;
  placeholder?: string;
  unit?: string;
  keyboardType?: KeyboardTypeOptions;
  onChange: (v: string) => void;
  tool?: ReactNode;
  last?: boolean;
  editable?: boolean;
}) {
  const { theme } = useTheme();
  const editable = props.editable !== false;
  return (
    <Line
      label={props.label}
      last={props.last}
      right={
        <View style={styles.inputRight}>
          {editable ? (
            <TextInput
              value={props.value}
              onChangeText={props.onChange}
              placeholder={props.placeholder}
              placeholderTextColor={theme.textFaint}
              keyboardType={props.keyboardType}
              accessibilityLabel={props.label}
              style={[TYPE.body, styles.input, { color: theme.text }]}
            />
          ) : (
            <Text style={[TYPE.body, styles.fixed, { color: theme.text }]}>
              {props.value || "—"}
            </Text>
          )}
          {props.unit ? (
            <Text style={[TYPE.body, { color: theme.textMuted }]}>{props.unit}</Text>
          ) : null}
          {props.tool}
        </View>
      }
    />
  );
}

export function SwitchRow(props: {
  label: string;
  value: boolean;
  onChange?: (v: boolean) => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Line
      label={props.label}
      last={props.last}
      right={
        <Switch
          value={props.value}
          onValueChange={props.onChange}
          disabled={!props.onChange}
          trackColor={{ true: theme.success, false: theme.border }}
          thumbColor="#FFFFFF"
          // react-native-web colours the "on" knob separately; keep it white like iOS (as drawn).
          {...({ activeThumbColor: "#FFFFFF" } as object)}
          accessibilityLabel={props.label}
        />
      }
    />
  );
}

/** The 22-bold heading above a group on these pages. */
export function Heading({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[TYPE.title2, styles.heading, { color: theme.text }]} accessibilityRole="header">
      {text}
    </Text>
  );
}

/** A small grey heading inside a sheet ("ราคา", "ชื่ออะไหล่ในระบบแอร์"). */
export function SmallHeading({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[TYPE.subhead, styles.small, { color: theme.text }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  search: {
    height: 40,
    borderRadius: RADIUS.field,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
    paddingHorizontal: SPACE.m - 2,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, outlineStyle: "none" } as never,
  tool: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tabsWrap: { marginTop: SPACE.l, marginHorizontal: -SPACE.l, overflow: "hidden" },
  tabs: { flexDirection: "row", gap: SPACE.l + 2, paddingHorizontal: SPACE.l },
  tab: { paddingTop: 6, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabOn: { fontWeight: "600" },
  chip: {
    height: 32,
    paddingLeft: SPACE.m,
    paddingRight: 10,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 170,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  step: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stepSign: { fontSize: 20, lineHeight: 22 },
  stepValue: { minWidth: 28, textAlign: "center", fontVariant: ["tabular-nums"] },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: SPACE.l },
  line: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  pickRight: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  count: { minWidth: 24, textAlign: "right", fontVariant: ["tabular-nums"] },
  tick: { width: 20, alignItems: "flex-end" },
  inputRight: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  input: { textAlign: "right", minWidth: 60, paddingVertical: 0, outlineStyle: "none" } as never,
  fixed: { textAlign: "right", fontVariant: ["tabular-nums"] },
  heading: { marginTop: SPACE.xxl, marginBottom: SPACE.m, marginHorizontal: 2 },
  small: { fontWeight: "600", marginHorizontal: SPACE.xs, marginTop: SPACE.xs },
});
