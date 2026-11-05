import { PRIMARY_TABS, activeHref } from "@l-shopee/shared/nav";
import { usePathname, useRouter } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { barBottom as barBottomFor, bottomBar, pageWidth, phoneBottoms } from "@/lib/frame";
import { initials } from "@/lib/initials";
import { drawerFor } from "@/lib/menuDrawer";
import { pageTitle } from "@/lib/pageTitle";
import { PROFILE_ROUTE } from "@/lib/profilePage";
import { roleWord } from "@/lib/staffPage";
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
import { MenuDrawer } from "./MenuDrawer";
import { Segmented } from "./Segmented";
import { MENU_ICON, PAGE_ICONS, TAB_ICONS } from "./tabIcons";
import { PHONE_MAX_WIDTH, SPACE, TYPE, type Theme } from "./theme";
import { UpdateBar } from "./UpdateBar";
import { WideButton, WideSearch, WideToast } from "./desk/WideTools";

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
  const router = useRouter();
  const path = usePathname();
  return {
    path,
    active: activeHref(path),
    go: (href: string) => router.push(href as never),
  };
}

function WideShell({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const brandFont = useBrandFont();
  const { go, path } = useNav();
  const [chrome, setChrome] = useState<Chrome>(NO_CHROME);
  const s = styles(theme);
  return (
    <View style={[s.fill, s.row, { backgroundColor: theme.deskPage }]}>
      {/* Computer guide C · Mercury (owner, 4 Nov 2026): a light sidebar with the phone's menu. */}
      <View style={s.sidebar}>
        <ScrollView contentContainerStyle={s.sidebarInner}>
          <Pressable onPress={() => go("/")} accessibilityRole="link">
            <Text style={[s.brand, brandFont]}>CrewEngine</Text>
          </Pressable>
          <DeskMenu path={path} onGo={go} />
        </ScrollView>
        <DeskAccount onGo={go} />
      </View>
      <View style={s.fill}>
        <ScrollView style={s.fill} contentContainerStyle={s.content}>
          {/* One centred column, or the full width for a list with a table (guide). */}
          <View style={[s.page, { maxWidth: pageWidth(chrome.layout) }]}>
            <UpdateBar />
            {chrome.ownTitle && chrome.headers.length > 0 ? (
              // A page with its own heading keeps its tools beside the way back, as on the phone.
              <View style={s.backRow}>
                {chrome.back && <BackPill back={chrome.back} />}
                <View style={s.fill} />
                {chrome.headers.map((h) => (
                  <WideButton key={h.label} button={h} />
                ))}
              </View>
            ) : (
              chrome.back && <BackPill back={chrome.back} />
            )}
            {!chrome.ownTitle && (
              <View style={s.wideHead}>
                {/* A title still loading is "" — a ternary, so no bare text lands in the View. */}
                <Text style={s.wideTitle} accessibilityRole="header" numberOfLines={2}>
                  {chrome.title ?? t(pageTitle(path))}
                </Text>
                {chrome.headers.map((h) => (
                  <WideButton key={h.label} button={h} />
                ))}
              </View>
            )}
            {chrome.search && <WideSearch search={chrome.search} />}
            <ChromeProvider value={setChrome}>{children}</ChromeProvider>
          </View>
        </ScrollView>
        {chrome.toast && chrome.footer.length === 0 && <WideToast toast={chrome.toast} />}
        {chrome.footer.length > 0 && (
          // The computer's pinned bar (guide #8): words on the left, grey second, red main on the right.
          <View style={s.wideBar}>
            <View style={s.fill}>
              {chrome.toast && (
                <Text style={s.wideToast} accessibilityRole="alert">
                  {[chrome.toast.title, chrome.toast.detail].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
            {chrome.choice && (
              <Segmented
                label={chrome.choice.label}
                options={chrome.choice.options}
                value={chrome.choice.value ?? ""}
                onChange={chrome.choice.onChange}
              />
            )}
            {[...chrome.footer].reverse().map((b) => (
              <View key={b.label} style={s.wideBarButton}>
                <BigButton label={b.label} onPress={b.onPress} kind={b.kind} icon={b.icon} />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const { path, active, go } = useNav();
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
        <UpdateBar />
        {chrome.ownTitle && chrome.headers.length > 0 ? (
          // A page with its own heading keeps its tools beside the way back (ตั้งค่าอะไหล่'s ⓘ ＋).
          <View style={s.backRow}>
            {chrome.back && <BackPill back={chrome.back} />}
            <View style={s.fill} />
            {chrome.headers.map((h) => (
              <RoundButton key={h.label} button={h} />
            ))}
          </View>
        ) : (
          chrome.back && <BackPill back={chrome.back} />
        )}
        {!chrome.ownTitle && (
          <View style={s.titleRow}>
            <Text style={s.largeTitle} accessibilityRole="header" numberOfLines={1}>
              {chrome.title ?? t(pageTitle(path))}
            </Text>
            {chrome.headers.map((h) => (
              <RoundButton key={h.label} button={h} />
            ))}
            <Pressable
              onPress={() => go(PROFILE_ROUTE)}
              accessibilityRole="button"
              accessibilityLabel={t({ th: "โปรไฟล์ของฉัน", en: "My profile" })}
              style={s.avatar}
            >
              <Text style={s.avatarText}>{initials(name)}</Text>
            </Pressable>
          </View>
        )}
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

      <MenuDrawer open={open} path={path} onClose={() => setOpen(false)} onGo={goAndClose} />
    </View>
  );
}

/** The computer sidebar: หน้าหลัก, then the role's pages in their four sections (the phone's ☰ menu). */
function DeskMenu(props: { path: string; onGo: (href: string) => void }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const auth = useAuth();
  const s = styles(theme);
  if (auth.status !== "signed-in") return null;
  const menu = drawerFor(auth.staff.role, props.path);
  const link = (href: string, label: string, on: boolean) => (
    <Pressable
      key={href}
      onPress={() => props.onGo(href)}
      accessibilityRole="link"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [s.link, (on || pressed) && { backgroundColor: theme.sideOn }]}
    >
      <LineIcon
        d={PAGE_ICONS[href] ?? PAGE_ICONS["/"]!}
        color={on ? theme.text : theme.textMuted}
        size={17}
        strokeWidth={1.8}
      />
      <Text style={[s.linkText, on && s.linkTextOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <>
      {link("/", t({ th: "หน้าหลัก", en: "Home" }), menu.home.on)}
      {menu.groups.map((g) => (
        <View key={g.section.en}>
          <Text style={s.section}>{t(g.section)}</Text>
          {g.links.map((l) => link(l.href, t(l.label), l.on))}
        </View>
      ))}
    </>
  );
}

/** Who is signed in, at the foot of the sidebar; a tap opens โปรไฟล์ของฉัน (ภาษา · โหมดมืด · ออกจากระบบ). */
function DeskAccount({ onGo }: { onGo: (href: string) => void }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const auth = useAuth();
  const s = styles(theme);
  if (auth.status !== "signed-in") return null;
  return (
    <Pressable
      onPress={() => onGo(PROFILE_ROUTE)}
      accessibilityRole="button"
      accessibilityLabel={t({ th: "โปรไฟล์ของฉัน", en: "My profile" })}
      style={({ pressed }) => [s.account, pressed && { backgroundColor: theme.sideOn }]}
    >
      <View style={s.avatar}>
        <Text style={s.avatarText}>{initials(auth.staff.name)}</Text>
      </View>
      <View style={s.fill}>
        <Text style={s.staffName} numberOfLines={1}>
          {auth.staff.name}
        </Text>
        <Text style={s.staffRole}>{t(roleWord(auth.staff.role))}</Text>
      </View>
      <LineIcon d={ICON_CHEVRON} color={theme.textFaint} size={14} strokeWidth={2.4} />
    </Pressable>
  );
}

const ICON_CHEVRON = "M9 5l7 7-7 7";
const BACK_ICON = "M15 5l-7 7 7 7";
const SEARCH_ICON = "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5";
const CLOSE_ICON = "M6 6l12 12M18 6L6 18";

/** "‹ ออเดอร์" — the way back from a page that sits under another one. */
function BackPill({ back }: { back: BackLink }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const s = styles(theme);
  return (
    <Pressable
      onPress={back.onPress}
      accessibilityRole="link"
      accessibilityLabel={back.label || t({ th: "กลับ", en: "Back" })}
      style={[s.backPill, !back.label && s.backRound, back.plain && s.backPlain]}
    >
      {!back.plain && <LineIcon d={BACK_ICON} color={theme.text} size={20} strokeWidth={2.4} />}
      {back.label ? <Text style={s.backText}>{back.label}</Text> : null}
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

const styles = (c: Theme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    row: { flexDirection: "row" },
    sidebar: {
      width: 232,
      flexGrow: 0,
      backgroundColor: c.sidebar,
      borderRightWidth: 1,
      borderRightColor: c.border,
    },
    sidebarInner: { paddingTop: 16, paddingBottom: SPACE.m, paddingHorizontal: 12 },
    brand: {
      color: c.text,
      fontSize: 20,
      paddingTop: 2,
      paddingHorizontal: 10,
      paddingBottom: 10,
    },
    section: {
      ...TYPE.footnote,
      fontSize: 12,
      lineHeight: 16,
      color: c.textMuted,
      marginTop: 12,
      marginHorizontal: 10,
      marginBottom: 2,
    },
    link: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 30,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    linkText: { ...TYPE.subhead, flex: 1, color: c.text },
    linkTextOn: { fontWeight: "600" },
    account: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      margin: 12,
      marginTop: 0,
      padding: 10,
      borderRadius: 10,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    staffRole: { ...TYPE.footnote, fontSize: 12, color: c.textMuted },
    content: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 40 },
    page: { width: "100%", alignSelf: "center" },
    wideHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: SPACE.l },
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
    wideBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    wideBarButton: { minWidth: 180 },
    wideTitle: { flex: 1, fontSize: 28, lineHeight: 35, fontWeight: "600", color: c.text },
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
    backRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    backRound: { width: 36, paddingLeft: 0, paddingRight: 0, justifyContent: "center" },
    backPlain: { paddingLeft: 14 },
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
    staffName: { ...TYPE.subhead, color: c.text },
  });
