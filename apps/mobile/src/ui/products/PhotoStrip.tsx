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
import { leadAndRest } from "@/lib/productPage";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { SPACE, TYPE } from "../theme";
import type { EditPhoto, ProductFormState } from "./useProductEdit";

const TILE = 74;
/** The computer's small photos, under the big one (DeskProductPage board 10b, A2). */
const SMALL_TILE = 72;
const MENU_WIDTH = 250;
const CAMERA_ICON = "M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z";
const ALBUM_ICON = "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5h.01";

/**
 * The photos at the top of แก้ไขสินค้า: each with ✕, the first marked รูปหลัก, then ＋ เพิ่มรูป, which
 * offers ถ่ายรูป (the phone's own camera) or เลือกจากคลังภาพ (its album) — canvas v194. `lead`: the
 * computer's form (A2, laid out like its product page): the first photo this big, the others small
 * under it; with no photo yet, that big square is เพิ่มรูป.
 */
export function PhotoStrip({ edit, lead }: { edit: ProductFormState; lead?: number }) {
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
  const tile = (photo: EditPhoto, index: number, size: number) => (
    <Tile
      key={photo.id}
      photo={photo}
      index={index}
      size={size}
      inside={!!lead}
      onRemove={() => edit.removePhoto(photo.id)}
    />
  );
  const add = (size: number) => (
    <View ref={anchor} collapsable={false}>
      <AddTile size={size} onPress={open} />
    </View>
  );
  const { lead: first, rest } = leadAndRest(edit.photos);
  return (
    <>
      {lead ? (
        <View style={[styles.lead, { width: lead }]}>
          {first ? tile(first, 0, lead) : add(lead)}
          {first && (
            <View style={styles.grid}>
              {rest.map((photo, i) => tile(photo, i + 1, SMALL_TILE))}
              {add(SMALL_TILE)}
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {edit.photos.map((photo, i) => tile(photo, i, TILE))}
          {add(TILE)}
        </ScrollView>
      )}
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

/**
 * One photo with its ✕ (and รูปหลัก on the first). The phone's ✕ sits on the tile's corner; the
 * computer's (`inside`) sits just inside it, bigger on the big photo (A2).
 */
function Tile(props: {
  photo: EditPhoto;
  index: number;
  size: number;
  inside: boolean;
  onRemove: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { photo, index, size } = props;
  const big = size > SMALL_TILE * 2;
  const chip = {
    backgroundColor: theme.surface,
    borderWidth: theme.cardLine,
    borderColor: theme.border,
  };
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={{ uri: photo.kind === "saved" ? `${API_BASE}/img/${photo.imageKey}` : photo.uri }}
        resizeMode={big ? "contain" : "cover"}
        style={[
          styles.photo,
          { width: size, height: size, backgroundColor: theme.hover },
          big && [styles.bigPhoto, { borderColor: theme.border }],
        ]}
      />
      {props.index === 0 && (
        <View style={[styles.main, big && styles.mainBig, chip]}>
          <Text style={[big ? TYPE.footnote : TYPE.caption, { color: theme.text }]}>
            {t({ th: "รูปหลัก", en: "Main" })}
          </Text>
        </View>
      )}
      <Pressable
        onPress={props.onRemove}
        accessibilityRole="button"
        accessibilityLabel={t({
          th: `เอารูปที่ ${index + 1} ออก`,
          en: `Remove photo ${index + 1}`,
        })}
        hitSlop={6}
        style={[
          styles.remove,
          props.inside && (big ? styles.removeBig : styles.removeInside),
          chip,
        ]}
      >
        <LineIcon d={ICON.close} color={theme.text} size={11} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

/** ＋ เพิ่มรูป: a dashed-looking square the size of a photo. */
function AddTile({ size, onPress }: { size: number; onPress: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.add,
        { width: size, height: size, borderColor: theme.textFaint, backgroundColor: theme.surface },
      ]}
    >
      <LineIcon d={ICON.plus} color={theme.text} size={20} strokeWidth={2} />
      <Text style={[TYPE.footnote, { color: theme.text }]}>
        {t({ th: "เพิ่มรูป", en: "Add photo" })}
      </Text>
    </Pressable>
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
  lead: { gap: SPACE.m },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photo: { borderRadius: 12 },
  // The big photo: square like the page's, with a thin edge so it shows on white (A2).
  bigPhoto: { borderRadius: 16, borderWidth: 1 },
  main: {
    position: "absolute",
    left: 4,
    bottom: 4,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  mainBig: { left: 10, bottom: 10, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 2 },
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
  removeInside: { right: 4, top: 4 },
  removeBig: { right: 10, top: 10, width: 24, height: 24, borderRadius: 12 },
  add: {
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
