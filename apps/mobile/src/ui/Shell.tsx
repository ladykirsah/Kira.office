import { PRIMARY_TABS, activeHref, navGroupsFor, type NavGroup } from "@l-shopee/shared/nav";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { barBottom as barBottomFor, bottomBar, phoneBottoms } from "@/lib/frame";
import { initials } from "@/lib/initials";
import { pageTitle } from "@/lib/pageTitle";
import { useAuth, useLang, useTheme } from "./AppProviders";
import { BigButton } from "./BigButton";
import { useBrandFont } from "./brandFont";
import { LineIcon } from "./LineIcon";
import { PinnedFooter, pinnedHeight } from "./PinnedFooter";
import {
  ChromeProvider,
  NO_CHROME,
  type BackLink,
  type Chrome,
  type HeaderButton,
  type SearchBar,
} from "./ScreenChrome";
import { Segmented } from "./Segmented";
import { MENU_ICON, TAB_ICONS } from "./tabIcons";
import { PHONE_MAX_WIDTH, SPACE, TYPE, type Theme } from "./theme";

/**
 * The frame around every screen. On a phone it follows the approved design guide (2026-10-26): the
 * page's large title with the account badge, and a floating bar with the owner's four tabs plus a
 * round ☰ button for everything else. On a computer it is still the sidebar — the computer layout is
 * redesigned last. Both read the one menu in @l-shopee/shared, filtered by role.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  return width <= PHONE_MAX_WIDTH ? (
    <PhoneShell>{children}</PhoneShell>
  ) : (
    <WideShell>{children}</WideShell>
  );
}

function useNav() {
  const auth = useAuth();
  const router = useRouter();
  const path = usePathname();
  const groups = auth.status === "signed-in" ? navGroupsFor(auth.staff.role) : [];
  return {
    groups,
    path,
    active: activeHref(path),
    go: (href: string) => router.push(href as never),
  };
}

function WideShell({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const brandFont = useBrandFont();
  const { groups, active, go } = useNav();
  const [chrome, setChrome] = useState<Chrome>(NO_CHROME);
  const s = styles(theme);
  return (
    <View style={[s.fill, s.row, { backgroundColor: theme.bg }]}>
      <ScrollView style={s.sidebar} contentContainerStyle={s.sidebarInner}>
        <Pressable onPress={() => go("/")} accessibilityRole="link">
          <Text style={[s.brand, brandFont]}>CrewEngine</Text>
        </Pressable>
        <MenuGroups groups={groups} active={active} onGo={go} compact />
      </ScrollView>
      <View style={s.fill}>
        <View style={s.topbar}>
          <View style={s.fill} />
          {chrome.headers.map((h) => (
            <RoundButton key={h.label} button={h} />
          ))}
          <Toolbar />
        </View>
        <ScrollView style={s.fill} contentContainerStyle={s.content}>
          {chrome.back && <BackPill back={chrome.back} />}
          {/* A title still loading is "" — a ternary, so no bare text lands in the View. */}
          {chrome.title ? (
            <Text style={s.wideTitle} accessibilityRole="header">
              {chrome.title}
            </Text>
          ) : null}
          <ChromeProvider value={setChrome}>{children}</ChromeProvider>
          {chrome.footer.length > 0 && (
            <View style={s.wideFooter}>
              {chrome.toast && (
                <Text style={s.wideToast} accessibilityRole="alert">
                  {chrome.toast.title} · {chrome.toast.detail}
                </Text>
              )}
              {chrome.choice && (
                <Segmented
                  label={chrome.choice.label}
                  options={chrome.choice.options}
                  value={chrome.choice.value ?? ""}
                  onChange={chrome.choice.onChange}
                />
              )}
              {chrome.footer.map((b) => (
                <BigButton
                  key={b.label}
                  label={b.label}
                  onPress={b.onPress}
                  kind={b.kind}
                  icon={b.icon}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const brandFont = useBrandFont();
  const { t } = useLang();
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const { groups, path, active, go } = useNav();
  const [open, setOpen] = useState(false);
  const [chrome, setChrome] = useState<Chrome>(NO_CHROME);
  const s = styles(theme);
  const name = auth.status === "signed-in" ? auth.staff.name : "";
  // The tab bar is for main pages only; a page with a back link has none (owner, 29 Oct).
  const bar = bottomBar(chrome);
  const barBottom = barBottomFor(insets.bottom);
  const bottoms = phoneBottoms({ bar, insetBottom: insets.bottom, pinned: pinnedHeight(chrome) });
  const goAndClose = (href: string) => {
    setOpen(false);
    go(href);
  };
  return (
    <View style={[s.fill, { backgroundColor: theme.bg }]}>
      <ScrollView
        style={s.fill}
        contentContainerStyle={[
          s.phoneContent,
          {
            paddingTop: insets.top + SPACE.m,
            paddingBottom: bottoms.content,
          },
        ]}
      >
        {chrome.back && <BackPill back={chrome.back} />}
        <View style={s.titleRow}>
          <Text style={s.largeTitle} accessibilityRole="header" numberOfLines={1}>
            {chrome.title ?? t(pageTitle(path))}
          </Text>
          {chrome.headers.map((h) => (
            <RoundButton key={h.label} button={h} />
          ))}
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t({ th: `บัญชีของ ${name}`, en: `${name}'s account` })}
            style={s.avatar}
          >
            <Text style={s.avatarText}>{initials(name)}</Text>
          </Pressable>
        </View>
        <ChromeProvider value={setChrome}>{children}</ChromeProvider>
      </ScrollView>

      <PinnedFooter chrome={chrome} bottom={bottoms.footer} />

      {chrome.search ? (
        <SearchRow search={chrome.search} bottom={barBottom} />
      ) : bar === "none" ? null : (
        <View style={[s.barRow, { bottom: barBottom }]} pointerEvents="box-none">
          <View style={s.barPill} accessibilityRole="tablist">
            {PRIMARY_TABS.map((tab) => {
              const on = tab.href === active;
              const color = on ? theme.primary : theme.text;
              return (
                <Pressable
                  key={tab.href}
                  onPress={() => go(tab.href)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t(tab.label)}
                  style={[s.tab, on && s.tabOn]}
                >
                  <LineIcon d={TAB_ICONS[tab.href] ?? MENU_ICON} color={color} />
                  <Text style={[s.tabLabel, { color }]} numberOfLines={1}>
                    {t(tab.short ?? tab.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t({ th: "เมนูทั้งหมด", en: "All pages" })}
            style={s.menuButton}
          >
            <LineIcon d={MENU_ICON} color={theme.text} strokeWidth={2} />
          </Pressable>
        </View>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={[s.fill, s.row]}>
          <ScrollView
            style={[s.drawer, { paddingTop: insets.top }]}
            contentContainerStyle={s.drawerInner}
            accessibilityLabel={t({ th: "เมนูหลัก", en: "Main" })}
          >
            <Pressable onPress={() => goAndClose("/")} accessibilityRole="link">
              <Text style={[s.brand, brandFont]}>CrewEngine</Text>
            </Pressable>
            <MenuGroups groups={groups} active={active} onGo={goAndClose} withPrefs />
          </ScrollView>
          <Pressable
            style={[s.fill, { backgroundColor: theme.scrim }]}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t({ th: "ปิดเมนู", en: "Close menu" })}
          />
        </View>
      </Modal>
    </View>
  );
}

function MenuGroups(props: {
  groups: NavGroup[];
  active: string | undefined;
  onGo: (href: string) => void;
  compact?: boolean;
  withPrefs?: boolean;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const s = styles(theme);
  return (
    <>
      {props.groups.map((g) => (
        <View key={g.section.en}>
          <Text style={s.section}>{t(g.section)}</Text>
          {g.links.map((l) => {
            const on = l.href === props.active;
            return (
              <Pressable
                key={l.href}
                onPress={() => props.onGo(l.href)}
                accessibilityRole="link"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  s.link,
                  props.compact && s.linkCompact,
                  pressed && !on && { backgroundColor: theme.hover },
                  on && s.linkOn,
                ]}
              >
                <Text style={s.linkIcon}>{l.icon}</Text>
                <Text style={[s.linkText, props.compact && s.linkTextCompact, on && s.linkTextOn]}>
                  {t(l.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Account withPrefs={props.withPrefs} />
    </>
  );
}

/** Who is signed in, and on a phone the language and light/dark switches that the top bar had. */
function Account({ withPrefs }: { withPrefs?: boolean }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { lang, t, toggleLang } = useLang();
  const auth = useAuth();
  const s = styles(theme);
  if (auth.status !== "signed-in") return null;
  return (
    <View style={s.accountBlock}>
      <Text style={s.staffName}>{auth.staff.name}</Text>
      {withPrefs && (
        <View style={s.prefRow}>
          <Pill onPress={toggleLang}>{lang === "th" ? "English" : "ภาษาไทย"}</Pill>
          <Pill onPress={toggleTheme}>
            {t(isDark ? { th: "โหมดสว่าง", en: "Light mode" } : { th: "โหมดมืด", en: "Dark mode" })}
          </Pill>
        </View>
      )}
      <Pressable
        onPress={() => void auth.signOutNow()}
        accessibilityRole="button"
        style={s.signOut}
      >
        <Text style={s.signOutText}>{t({ th: "ออกจากระบบ", en: "Sign out" })}</Text>
      </Pressable>
    </View>
  );
}

function Pill(props: { onPress: () => void; children: string }) {
  const { theme } = useTheme();
  const s = styles(theme);
  return (
    <Pressable onPress={props.onPress} accessibilityRole="button" style={s.pill}>
      <Text style={s.pillText}>{props.children}</Text>
    </Pressable>
  );
}

const BACK_ICON = "M15 5l-7 7 7 7";
const SEARCH_ICON = "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5";
const CLOSE_ICON = "M6 6l12 12M18 6L6 18";

/** "‹ ออเดอร์" — the way back from a page that sits under another one. */
function BackPill({ back }: { back: BackLink }) {
  const { theme } = useTheme();
  const s = styles(theme);
  return (
    <Pressable onPress={back.onPress} accessibilityRole="link" style={s.backPill}>
      <LineIcon d={BACK_ICON} color={theme.text} size={20} strokeWidth={2.4} />
      <Text style={s.backText}>{back.label}</Text>
    </Pressable>
  );
}

/** While a screen searches, the field sits where the tab bar was, with a round ✕ to stop. */
function SearchRow({ search, bottom }: { search: SearchBar; bottom: number }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const s = styles(theme);
  return (
    <View style={[s.barRow, { bottom }]} pointerEvents="box-none">
      <View style={[s.barPill, s.searchField]}>
        <LineIcon d={SEARCH_ICON} color={theme.text} size={18} strokeWidth={2.2} />
        <TextInput
          value={search.value}
          onChangeText={search.onChange}
          placeholder={search.placeholder}
          placeholderTextColor={theme.textMuted}
          autoFocus
          returnKeyType="search"
          accessibilityLabel={search.placeholder}
          style={s.searchInput}
        />
        {search.value !== "" && (
          <Pressable
            onPress={() => search.onChange("")}
            accessibilityRole="button"
            accessibilityLabel={t({ th: "ล้างคำค้น", en: "Clear" })}
            hitSlop={12}
            style={s.searchClear}
          >
            <LineIcon d={CLOSE_ICON} color={theme.bg} size={10} strokeWidth={4} />
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={search.onClose}
        accessibilityRole="button"
        accessibilityLabel={t({ th: "ปิดการค้นหา", en: "Close search" })}
        style={s.menuButton}
      >
        <LineIcon d={CLOSE_ICON} color={theme.text} size={18} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

/** The screen's own tool, a round glass button beside the account badge — or a word, with no icon. */
function RoundButton({ button }: { button: HeaderButton }) {
  const { theme } = useTheme();
  const s = styles(theme);
  const count = button.badge ?? 0;
  return (
    <Pressable
      onPress={button.onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${button.label} ${count}` : button.label}
      style={button.icon ? s.roundButton : [s.roundButton, s.wordButton]}
    >
      {button.icon ? (
        <LineIcon d={button.icon} color={theme.text} size={20} />
      ) : (
        <Text style={s.wordButtonText}>{button.label}</Text>
      )}
      {count > 0 && (
        <View style={s.badge} pointerEvents="none">
          <Text style={s.badgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Language and light/dark, the same two buttons the web top bar carries. */
function Toolbar() {
  const { lang, t, toggleLang } = useLang();
  const { isDark, toggleTheme } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <IconButton
        label={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
        onPress={toggleLang}
      >
        {lang === "th" ? "🇬🇧" : "🇹🇭"}
      </IconButton>
      <IconButton
        label={t(
          isDark ? { th: "โหมดสว่าง", en: "Light mode" } : { th: "โหมดมืด", en: "Dark mode" },
        )}
        onPress={toggleTheme}
      >
        {isDark ? "☀️" : "🌙"}
      </IconButton>
    </View>
  );
}

function IconButton(props: { label: string; onPress: () => void; children: string }) {
  const { theme } = useTheme();
  const s = styles(theme);
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={s.iconButton}
    >
      <Text style={s.iconButtonText}>{props.children}</Text>
    </Pressable>
  );
}

const styles = (c: Theme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    row: { flexDirection: "row" },
    sidebar: {
      width: 232,
      flexGrow: 0,
      backgroundColor: c.surface,
      borderRightWidth: 1,
      borderRightColor: c.border,
    },
    sidebarInner: { paddingVertical: 14, paddingHorizontal: 12 },
    brand: {
      color: c.primary,
      fontWeight: "700",
      fontSize: 18,
      paddingTop: 8,
      paddingHorizontal: 10,
      paddingBottom: 4,
    },
    section: {
      ...TYPE.footnote,
      color: c.textMuted,
      marginTop: SPACE.xxl,
      marginHorizontal: 10,
      marginBottom: SPACE.xs,
    },
    link: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    linkCompact: { minHeight: 0, paddingVertical: 6 },
    linkOn: { backgroundColor: c.tabOn },
    linkIcon: { fontSize: 17, width: 22, textAlign: "center" },
    linkText: { ...TYPE.body, color: c.text },
    linkTextCompact: { ...TYPE.subhead },
    linkTextOn: { color: c.primary, fontWeight: "600" },
    topbar: {
      height: 56,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 24,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    content: { padding: 24, maxWidth: 1280 },
    phoneContent: { paddingHorizontal: SPACE.l },
    titleRow: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 2,
      marginBottom: SPACE.m,
    },
    largeTitle: { ...TYPE.largeTitle, flex: 1, color: c.text },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.graphite,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
    roundButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.glassLine,
      boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    },
    wordButton: { width: "auto", paddingHorizontal: 14 },
    wordButtonText: { ...TYPE.subhead, color: c.text },
    badge: {
      position: "absolute",
      top: -2,
      right: -4,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: c.text,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { fontSize: 11, lineHeight: 14, fontWeight: "700", color: c.bg },
    wideFooter: { marginTop: SPACE.xxl, maxWidth: 420, gap: 10 },
    wideTitle: { ...TYPE.largeTitle, color: c.text, marginBottom: SPACE.m },
    backPill: {
      alignSelf: "flex-start",
      height: 36,
      paddingLeft: 8,
      paddingRight: 14,
      borderRadius: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      marginBottom: SPACE.s,
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.glassLine,
      boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    },
    backText: { ...TYPE.body, color: c.text },
    searchField: {
      height: 52,
      borderRadius: 26,
      justifyContent: "flex-start",
      gap: SPACE.s,
      paddingLeft: SPACE.l,
      paddingRight: SPACE.m,
    },
    searchInput: {
      ...TYPE.body,
      flex: 1,
      minWidth: 0,
      color: c.text,
      outlineStyle: "none",
    } as never,
    searchClear: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: c.textFaint,
      alignItems: "center",
      justifyContent: "center",
    },
    wideToast: { ...TYPE.subhead, color: c.textMuted },
    barRow: {
      position: "absolute",
      left: 14,
      right: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    barPill: {
      flex: 1,
      height: 62,
      borderRadius: 31,
      paddingHorizontal: 5,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.glassLine,
      boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
    },
    tab: {
      flex: 1,
      maxWidth: 76,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    tabOn: { backgroundColor: c.tabOn },
    tabLabel: { ...TYPE.caption },
    menuButton: {
      width: 62,
      height: 62,
      borderRadius: 31,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.glassLine,
      boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
    },
    drawer: {
      width: 300,
      maxWidth: "84%",
      flexGrow: 0,
      backgroundColor: c.bg,
    },
    drawerInner: { paddingVertical: 14, paddingHorizontal: 12, paddingBottom: 40 },
    iconButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      backgroundColor: c.surface,
    },
    iconButtonText: { fontSize: 16, color: c.text },
    accountBlock: {
      marginTop: SPACE.xxl,
      marginHorizontal: 10,
      paddingTop: SPACE.l,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: SPACE.m,
    },
    staffName: { ...TYPE.headline, color: c.text },
    prefRow: { flexDirection: "row", gap: SPACE.s, flexWrap: "wrap" },
    pill: {
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 17,
      backgroundColor: c.hover,
      alignItems: "center",
      justifyContent: "center",
    },
    pillText: { ...TYPE.subhead, color: c.text },
    signOut: { alignSelf: "flex-start", paddingVertical: 6 },
    signOutText: { ...TYPE.body, color: c.primary },
  });
