import type { Phrase } from "@l-shopee/shared/lang";
import { useRef, useState, type ComponentRef } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { API_BASE } from "@/lib/config";
import { copyText } from "@/lib/copyText";
import { copiedToast, type ShopLang, type ShopProfile } from "@/lib/shopInfoPage";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Divider, Line } from "../products/parts";
import { Segmented } from "../Segmented";
import { SPACE, TYPE } from "../theme";

/** Until a shop has a logo, its round badge says who it is (canvas: DEN, AIR+). */
const BADGE: Record<ShopProfile, string> = { denair: "DEN", airplus: "AIR+" };

/** The shop's round logo; `change` adds the dark เปลี่ยน band across its foot (edit mode). */
export function ShopLogo(props: {
  profile: ShopProfile;
  logoKey: string | null;
  size: number;
  change?: string;
}) {
  const round = { width: props.size, height: props.size, borderRadius: props.size / 2 };
  return (
    <View style={[styles.logo, round]}>
      {props.logoKey ? (
        <Image source={{ uri: `${API_BASE}/img/${props.logoKey}` }} style={round} />
      ) : (
        <Text style={[styles.badge, { fontSize: props.size / 4 }]}>{BADGE[props.profile]}</Text>
      )}
      {props.change ? (
        <View style={styles.band}>
          <Text style={styles.bandText}>{props.change}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** ไทย | EN — the one place the page's language is chosen; it opens on the app's language. */
export function LangSwitch(props: { value: ShopLang; onChange: (lang: ShopLang) => void }) {
  const { t } = useLang();
  return (
    <View style={styles.lang}>
      <Segmented
        label={t({ th: "ภาษา", en: "Language" })}
        options={[
          { value: "th", label: "ไทย" },
          { value: "en", label: "EN" },
        ]}
        value={props.value}
        onChange={props.onChange}
      />
    </View>
  );
}

/** A ติดต่อ row: the value, and the plain copy mark when there is something to copy (owner, 2 Nov). */
export function CopyLine(props: {
  label: string;
  what: Phrase;
  value: string;
  onCopied: (said: Phrase) => void;
  last?: boolean;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const copy = async () =>
    props.onCopied(
      (await copyText(props.value))
        ? copiedToast(props.what)
        : { th: "คัดลอกไม่ได้", en: "Could not copy" },
    );
  return (
    <Line
      label={props.label}
      last={props.last}
      right={
        <View style={styles.copyRight}>
          <Text style={[TYPE.body, styles.value, { color: theme.text }]} numberOfLines={1}>
            {props.value || "—"}
          </Text>
          {props.value ? (
            <Pressable
              onPress={() => void copy()}
              accessibilityRole="button"
              accessibilityLabel={t({
                th: `คัดลอก${props.what.th}`,
                en: `Copy the ${props.what.en}`,
              })}
              style={styles.copy}
            >
              <LineIcon d={ICON.copy} color={theme.text} size={16} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      }
    />
  );
}

/** A plain row with its value in black on the right (ตั้งค่าบิล, ส่งของ). */
export function ValueLine(props: { label: string; value: string; last?: boolean }) {
  const { theme } = useTheme();
  return (
    <Line
      label={props.label}
      last={props.last}
      right={
        <Text style={[TYPE.body, styles.value, { color: theme.text }]} numberOfLines={2}>
          {props.value || "—"}
        </Text>
      }
    />
  );
}

/** A long box — the address — with its label above and the words on as many lines as they need. */
export function ColumnInput(props: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <View style={styles.column}>
        <Text style={[TYPE.body, { color: theme.text }]}>{props.label}</Text>
        <TextInput
          value={props.value}
          onChangeText={props.onChange}
          placeholder={props.placeholder}
          placeholderTextColor={theme.textFaint}
          accessibilityLabel={props.label}
          multiline
          style={[TYPE.subhead, styles.columnInput, { color: theme.text }]}
        />
      </View>
      {!props.last && <Divider />}
    </View>
  );
}

/** The contact QR's small picture on the right of its row. */
export function QrThumb({ qrKey }: { qrKey: string | null }) {
  const { theme } = useTheme();
  if (!qrKey) return <Text style={[TYPE.body, { color: theme.text }]}>—</Text>;
  return (
    <Image
      source={{ uri: `${API_BASE}/img/${qrKey}` }}
      style={[styles.qr, { borderColor: theme.border }]}
    />
  );
}

const MENU_WIDTH = 250;

/**
 * Something that opens ถ่ายรูป / เลือกจากคลังภาพ just under itself (the logo, QR's เปลี่ยน). The menu is
 * measured from the thing pressed, because a press on the web carries no position.
 */
export function PhotoChoice(props: {
  children: (open: () => void) => React.ReactNode;
  onChoose: (source: "camera" | "library") => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const open = () =>
    anchor.current?.measureInWindow((x, y, w, h) =>
      setAt({
        x: Math.max(SPACE.l, Math.min(x + w / 2 - MENU_WIDTH / 2, width - MENU_WIDTH - SPACE.l)),
        y: y + h + 6,
      }),
    );
  const choose = (source: "camera" | "library") => {
    setAt(null);
    props.onChoose(source);
  };
  const item = (label: string, source: "camera" | "library", last?: boolean) => (
    <Pressable
      onPress={() => choose(source)}
      accessibilityRole="menuitem"
      style={[styles.item, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
    >
      <Text style={[TYPE.body, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
  return (
    <>
      <View ref={anchor} collapsable={false}>
        {props.children(open)}
      </View>
      <Modal visible={!!at} transparent animationType="fade" onRequestClose={() => setAt(null)}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.dim]}
          onPress={() => setAt(null)}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ปิด", en: "Close" })}
        />
        {at && (
          <View
            accessibilityRole="menu"
            style={[styles.menu, { top: at.y, left: at.x, backgroundColor: theme.surface }]}
          >
            {item(t({ th: "ถ่ายรูป", en: "Take photo" }), "camera")}
            {item(t({ th: "เลือกจากคลังภาพ", en: "Choose from album" }), "library", true)}
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: "#2C3036",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  badge: { color: "#FFFFFF", fontWeight: "800" },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 26,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  bandText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  lang: { width: 132, alignSelf: "center" },
  copyRight: { flexDirection: "row", alignItems: "center", gap: SPACE.s, flexShrink: 1 },
  value: { flexShrink: 1, textAlign: "right" },
  copy: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  column: { paddingVertical: SPACE.m, paddingHorizontal: SPACE.l, gap: 2 },
  columnInput: { padding: 0, minHeight: 22 },
  qr: { width: 44, height: 44, borderRadius: 6, borderWidth: 1 },
  dim: { backgroundColor: "rgba(0,0,0,0.08)" },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
  } as never,
  item: { minHeight: 46, paddingHorizontal: SPACE.l, justifyContent: "center" },
});
