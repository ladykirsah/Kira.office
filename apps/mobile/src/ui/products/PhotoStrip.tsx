import { useRef, useState, type ComponentRef } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { API_BASE } from "@/lib/config";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { SPACE, TYPE } from "../theme";
import type { ProductFormState } from "./useProductEdit";

const TILE = 74;
const MENU_WIDTH = 250;
const CAMERA_ICON = "M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z";
const ALBUM_ICON = "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5h.01";

/**
 * The photos at the top of แก้ไขสินค้า: each with ✕, the first marked รูปหลัก, then ＋ เพิ่มรูป, which
 * offers ถ่ายรูป (the phone's own camera) or เลือกจากคลังภาพ (its album) — canvas v194.
 */
export function PhotoStrip({ edit }: { edit: ProductFormState }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const open = () =>
    anchor.current?.measureInWindow((x, y, _w, h) =>
      setAt({ x: Math.min(x, width - MENU_WIDTH - SPACE.l), y: y + h + 6 }),
    );
  const choose = (source: "camera" | "library") => {
    setAt(null);
    edit.addPhoto(source);
  };
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {edit.photos.map((photo, i) => (
          <View key={photo.id} style={styles.tile}>
            <Image
              source={{
                uri: photo.kind === "saved" ? `${API_BASE}/img/${photo.imageKey}` : photo.uri,
              }}
              style={[styles.photo, { backgroundColor: theme.hover }]}
            />
            {i === 0 && (
              <View style={[styles.main, { backgroundColor: theme.surface }]}>
                <Text style={[TYPE.caption, { color: theme.text }]}>
                  {t({ th: "รูปหลัก", en: "Main" })}
                </Text>
              </View>
            )}
            <Pressable
              onPress={() => edit.removePhoto(photo.id)}
              accessibilityRole="button"
              accessibilityLabel={t({ th: `เอารูปที่ ${i + 1} ออก`, en: `Remove photo ${i + 1}` })}
              hitSlop={6}
              style={[styles.remove, { backgroundColor: theme.surface }]}
            >
              <LineIcon d={ICON.close} color={theme.text} size={11} strokeWidth={2.6} />
            </Pressable>
          </View>
        ))}
        <View ref={anchor} collapsable={false}>
          <Pressable
            onPress={open}
            accessibilityRole="button"
            style={[styles.add, { borderColor: theme.textFaint, backgroundColor: theme.surface }]}
          >
            <LineIcon d={ICON.plus} color={theme.text} size={20} strokeWidth={2} />
            <Text style={[TYPE.footnote, { color: theme.text }]}>
              {t({ th: "เพิ่มรูป", en: "Add photo" })}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <Modal visible={!!at} transparent animationType="fade" onRequestClose={() => setAt(null)}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.08)" }]}
          onPress={() => setAt(null)}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ปิด", en: "Close" })}
        />
        {at && (
          <View
            accessibilityRole="menu"
            style={[
              styles.menu,
              { top: at.y, left: Math.max(SPACE.l, at.x), backgroundColor: theme.surface },
            ]}
          >
            <MenuItem
              label={t({ th: "ถ่ายรูป", en: "Take photo" })}
              icon={CAMERA_ICON}
              onPress={() => choose("camera")}
            />
            <MenuItem
              label={t({ th: "เลือกจากคลังภาพ", en: "Choose from album" })}
              icon={ALBUM_ICON}
              onPress={() => choose("library")}
              last
            />
          </View>
        )}
      </Modal>
    </>
  );
}

function MenuItem(props: { label: string; icon: string; onPress: () => void; last?: boolean }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="menuitem"
      style={({ pressed }) => [
        styles.item,
        pressed && { backgroundColor: theme.hover },
        !props.last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{props.label}</Text>
      <LineIcon d={props.icon} color={theme.text} size={19} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: { gap: SPACE.s, paddingTop: SPACE.s, paddingRight: SPACE.l },
  tile: { width: TILE, height: TILE },
  photo: { width: TILE, height: TILE, borderRadius: 12 },
  main: {
    position: "absolute",
    left: 4,
    bottom: 4,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  remove: {
    position: "absolute",
    right: -4,
    top: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
  } as never,
  add: {
    width: TILE,
    height: TILE,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  item: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
    paddingHorizontal: SPACE.l,
  },
  grow: { flex: 1 },
});
