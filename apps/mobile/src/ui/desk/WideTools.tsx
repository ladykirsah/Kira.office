import { useRef, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import type { ChromeToast, HeaderButton, SearchBar } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";

const SEARCH_ICON = "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5";
const CLOSE_ICON = "M6 6l12 12M18 6L6 18";

/**
 * A page's own tool on a computer: the phone's round icon, with its name beside it — there is room,
 * and a named button needs no guessing (computer guide: actions on the right of the title).
 */
export function WideButton({ button }: { button: HeaderButton }) {
  const { theme } = useTheme();
  const count = button.badge ?? 0;
  // The page's one main action is red (computer guide: เพิ่ม… on a list); the rest are white.
  const ink = button.main ? theme.onPrimary : theme.text;
  const self = useRef<ComponentRef<typeof View>>(null);
  // The button tells the screen where it is: a press on the web carries no position.
  const press = () => {
    const node = self.current;
    if (!node?.measureInWindow) return button.onPress();
    node.measureInWindow((x, y, width, height) => button.onPress({ x, y, width, height }));
  };
  return (
    <Pressable
      ref={self}
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${button.label} ${count}` : button.label}
      style={(state) => {
        const lit = (state as { hovered?: boolean }).hovered || state.pressed;
        return [
          styles.button,
          button.main
            ? {
                backgroundColor: lit ? theme.primaryPressed : theme.button,
                borderColor: "transparent",
              }
            : { backgroundColor: lit ? theme.sideOn : theme.surface, borderColor: theme.border },
        ];
      }}
    >
      {button.icon ? <LineIcon d={button.icon} color={ink} size={17} /> : null}
      <Text
        style={[TYPE.subhead, button.main && styles.mainLabel, { color: ink }]}
        numberOfLines={1}
      >
        {button.label}
      </Text>
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.text }]} pointerEvents="none">
          <Text style={[styles.badgeText, { color: theme.bg }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * A short message on a computer page with no pinned bar (คัดลอกแล้ว, ลบไม่สำเร็จ): the phone's dark
 * pill, low in the middle of the page, so it shows whether or not the page has bottom buttons.
 */
export function WideToast({ toast }: { toast: ChromeToast }) {
  return (
    <View style={styles.toastRow} pointerEvents="none">
      <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text style={styles.toastTitle}>{toast.title}</Text>
        {toast.detail ? <Text style={styles.toastDetail}>{toast.detail}</Text> : null}
      </View>
    </View>
  );
}

/**
 * While a page searches on a computer, the field sits under the title (a phone puts it where the tab
 * bar was; a computer has no tab bar), with ✕ to stop.
 */
export function WideSearch({ search }: { search: SearchBar }) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <View style={styles.searchRow}>
      <View style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <LineIcon d={SEARCH_ICON} color={theme.textMuted} size={17} strokeWidth={2.2} />
        <TextInput
          value={search.value}
          onChangeText={search.onChange}
          placeholder={search.placeholder}
          placeholderTextColor={theme.textMuted}
          autoFocus
          returnKeyType="search"
          accessibilityLabel={search.placeholder}
          style={[styles.input, { color: theme.text }]}
        />
      </View>
      <Pressable
        onPress={search.onClose}
        accessibilityRole="button"
        accessibilityLabel={t({ th: "ปิดการค้นหา", en: "Close search" })}
        style={[styles.close, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <LineIcon d={CLOSE_ICON} color={theme.text} size={16} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mainLabel: { fontWeight: "600" },
  toastRow: { position: "absolute", left: 0, right: 0, bottom: SPACE.xxl, alignItems: "center" },
  toast: {
    maxWidth: 440,
    paddingVertical: SPACE.m,
    paddingHorizontal: SPACE.xl,
    borderRadius: 16,
    backgroundColor: "rgba(28,28,30,0.92)",
    gap: 2,
  },
  toastTitle: { ...TYPE.subhead, color: "#FFFFFF", textAlign: "center" },
  toastDetail: { ...TYPE.subhead, color: "rgba(255,255,255,0.72)", textAlign: "center" },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  badgeText: { fontSize: 12, lineHeight: 15, fontWeight: "700" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginBottom: SPACE.l },
  field: {
    flex: 1,
    maxWidth: 480,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
    paddingHorizontal: 14,
  },
  input: { ...TYPE.subhead, flex: 1, minWidth: 0, outlineStyle: "none" } as never,
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
