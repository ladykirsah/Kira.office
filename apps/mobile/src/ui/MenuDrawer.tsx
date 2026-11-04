import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { initials } from "@/lib/initials";
import { drawerFor } from "@/lib/menuDrawer";
import { PROFILE_ROUTE } from "@/lib/profilePage";
import { roleWord } from "@/lib/staffPage";
import { useAuth, useLang, useTheme } from "./AppProviders";
import { LineIcon } from "./LineIcon";
import { PAGE_ICONS } from "./tabIcons";
import { RADIUS, SPACE, TYPE, type Theme } from "./theme";

const CHEVRON = "M9 6l6 6-6 6";
const DRAWER_WIDTH = 300;

/**
 * The phone's ☰ menu, design C (owner, 4 Nov 2026: "C / apply to preview"): a side drawer with your
 * name on top (› to โปรไฟล์ของฉัน, where language, dark mode and sign out live), หน้าหลัก on a row of its own, then the
 * role's pages in their sections with the bottom bar's line icons; the page you are on is red on a
 * grey pill.
 */
export function MenuDrawer(props: {
  open: boolean;
  path: string;
  onClose: () => void;
  onGo: (href: string) => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  if (auth.status !== "signed-in") return null;
  const s = styles(theme);
  const staff = auth.staff;
  const menu = drawerFor(staff.role, props.path);

  return (
    <Modal visible={props.open} transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={s.screen}>
        <View style={[s.drawer, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={s.inner}
            accessibilityLabel={t({ th: "เมนูหลัก", en: "Main" })}
          >
            <Pressable
              onPress={() => props.onGo(PROFILE_ROUTE)}
              accessibilityRole="link"
              accessibilityLabel={t({ th: "โปรไฟล์ของฉัน", en: "My profile" })}
              style={s.account}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials(staff.name)}</Text>
              </View>
              <View style={s.fill}>
                <Text style={s.name} numberOfLines={1}>
                  {staff.name}
                </Text>
                <Text style={s.role}>{t(roleWord(staff.role))}</Text>
              </View>
              <LineIcon d={CHEVRON} color={theme.textFaint} size={15} strokeWidth={2.4} />
            </Pressable>

            <MenuRow
              icon={PAGE_ICONS["/"]}
              label={t({ th: "หน้าหลัก", en: "Home" })}
              on={menu.home.on}
              onPress={() => props.onGo("/")}
            />
            {menu.groups.map((g) => (
              <View key={g.section.en}>
                <Text style={s.section}>{t(g.section)}</Text>
                {g.links.map((l) => (
                  <MenuRow
                    key={l.href}
                    icon={PAGE_ICONS[l.href]}
                    label={t(l.label)}
                    on={l.on}
                    onPress={() => props.onGo(l.href)}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
        <Pressable
          style={[s.fill, { backgroundColor: theme.scrim }]}
          onPress={props.onClose}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ปิดเมนู", en: "Close menu" })}
        />
      </View>
    </Modal>
  );
}

function MenuRow(props: { icon: string; label: string; on: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const s = styles(theme);
  const color = props.on ? theme.primary : theme.text;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: props.on }}
      style={({ pressed }) => [
        s.row,
        props.on && { backgroundColor: theme.segBg },
        pressed && !props.on && { backgroundColor: theme.hover },
      ]}
    >
      <LineIcon d={props.icon} color={color} size={21} strokeWidth={1.9} />
      <Text style={[s.rowText, { color }]} numberOfLines={1}>
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = (c: Theme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    screen: { flex: 1, flexDirection: "row" },
    drawer: { width: DRAWER_WIDTH, backgroundColor: c.surface },
    inner: { paddingTop: SPACE.m, paddingHorizontal: 10, paddingBottom: SPACE.xxl },
    account: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACE.m,
      paddingTop: SPACE.xs,
      paddingHorizontal: SPACE.m,
      paddingBottom: SPACE.m,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.graphite,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
    name: { ...TYPE.body, color: c.text },
    role: { ...TYPE.footnote, color: c.textMuted },
    section: {
      ...TYPE.footnote,
      color: c.textMuted,
      marginTop: SPACE.l,
      marginHorizontal: SPACE.m,
      marginBottom: SPACE.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACE.m,
      height: 44,
      paddingHorizontal: SPACE.m,
      borderRadius: RADIUS.field,
    },
    rowText: { ...TYPE.body, flex: 1 },
  });
