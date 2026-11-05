import type { Phrase } from "@l-shopee/shared/lang";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { priceNote, SOURCE_LABEL, SOURCES } from "@/lib/affiliatePage";
import { useLang, useTheme } from "../AppProviders";
import { Empty } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { FieldError, FieldRow, Note } from "../pos/fields";
import { FormPage } from "../products/FormPage";
import { Heading, SwitchRow } from "../products/parts";
import { Segmented } from "../Segmented";
import { RADIUS, SPACE, TYPE } from "../theme";
import { CategorySheet } from "./CategorySheet";
import { CAMERA_ICON, CardPhoto } from "./parts";
import { useAffiliateForm, type AffiliateFormState } from "./useAffiliateForm";

const ALBUM_ICON = "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5h.01";
const MENU_WIDTH = 250;

/** เพิ่มรายการ (no id) or แก้ไขรายการ — the same form (canvas v238). */
export function AffiliateFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useLang();
  const { theme } = useTheme();
  const edit = useAffiliateForm(id ?? null);
  const title = id
    ? t({ th: "แก้ไขรายการ", en: "Edit card" })
    : t({ th: "เพิ่มรายการ", en: "Add a card" });

  if (!edit.form || !edit.items) {
    return (
      <FormPage
        title={title}
        back={t({ th: "สินค้านายหน้า", en: "Affiliate items" })}
        deskLayout="column"
        onCancel={edit.leave}
      >
        {edit.problem === "gone" ? (
          <Empty
            icon={ICON.search}
            title={t({ th: "ไม่มีรายการนี้แล้ว", en: "This card is gone" })}
            detail={t({ th: "อาจถูกลบไปแล้ว", en: "It may have been deleted" })}
          />
        ) : edit.problem === "failed" ? (
          <Text style={[TYPE.subhead, { color: theme.text }]}>
            {t({ th: "โหลดไม่ได้ ลองอีกครั้ง", en: "It did not load. Try again" })}
          </Text>
        ) : (
          <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
        )}
      </FormPage>
    );
  }
  return (
    <FormPage
      title={title}
      // On a computer the form opens inside the frame, under its list (DeskAddProduct's form frame).
      back={t({ th: "สินค้านายหน้า", en: "Affiliate items" })}
      deskLayout="column"
      onCancel={edit.leave}
      save={{ label: t({ th: "บันทึก", en: "Save" }), onPress: () => void edit.save() }}
      toast={edit.toast ? { title: t(edit.toast.title), detail: t(edit.toast.detail) } : null}
    >
      <Fields edit={edit} />
    </FormPage>
  );
}

function Fields({ edit }: { edit: AffiliateFormState }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const f = edit.form!;
  const note = priceNote(edit.lookup);
  const category = edit.categories.find((c) => c.id === f.categoryId);
  const errors = [edit.errors.link, edit.errors.name].filter((p): p is Phrase => p != null);
  return (
    <>
      <PhotoBox edit={edit} />
      <View style={styles.store}>
        <Segmented
          label={t({ th: "ร้านปลายทาง", en: "Store" })}
          options={SOURCES.map((s) => ({ value: s, label: t(SOURCE_LABEL[s]) }))}
          value={f.source}
          onChange={(source) => edit.set({ source })}
        />
      </View>

      <Heading text={t({ th: "การ์ด", en: "Card" })} />
      <Group>
        <FieldRow
          label={t({ th: "ลิงก์", en: "Link" })}
          value={f.link}
          placeholder="https://"
          keyboardType="url"
          onChange={edit.setLink}
        />
        <FieldRow
          label={t({ th: "ชื่อ", en: "Name" })}
          value={f.name}
          placeholder={t({ th: "เช่น ชุดเกจวัดน้ำยาแอร์", en: "e.g. AC gauge set" })}
          onChange={(name) => edit.set({ name })}
        />
        <FieldRow
          label={t({ th: "ราคา", en: "Price" })}
          value={f.price}
          placeholder={t({ th: "พิมพ์ราคา", en: "Type the price" })}
          keyboardType="numbers-and-punctuation"
          onChange={edit.setPrice}
        />
        <Pressable
          onPress={() => edit.setSheet("category")}
          accessibilityRole="button"
          style={styles.choice}
        >
          <Text style={[TYPE.subhead, styles.label, { color: theme.text }]}>
            {t({ th: "หมวดหมู่", en: "Category" })}
          </Text>
          <Text style={[TYPE.body, styles.value, { color: theme.text }]} numberOfLines={1}>
            {category?.name ?? t({ th: "ไม่มีหมวด", en: "No category" })}
          </Text>
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        </Pressable>
      </Group>
      {errors.map((p) => (
        <FieldError key={p.th} text={t(p)} />
      ))}
      {note && <Note>{t(note)}</Note>}

      <Heading text={t({ th: "แสดงที่ไหน", en: "Where it shows" })} />
      <Group>
        <SwitchRow
          label={t({ th: "แสดง", en: "Show" })}
          value={f.shown}
          onChange={(shown) => edit.set({ shown })}
        />
        <SwitchRow
          label={t({ th: "ปักหมุด", en: "Pin" })}
          value={f.pinned}
          onChange={(pinned) => edit.set({ pinned })}
          last
        />
      </Group>

      {edit.sheet === "category" && (
        <CategorySheet
          categories={edit.categories}
          current={f.categoryId}
          token={edit.token}
          onMade={(c) => edit.setCategories((all) => [...all, c])}
          onClose={() => edit.setSheet(null)}
          onPick={(c) => {
            edit.set({ categoryId: c?.id ?? null });
            edit.setSheet(null);
          }}
        />
      )}
    </>
  );
}

/**
 * No photo yet: the เพิ่มรูป tile. With one: the photo fills the width, with เปลี่ยนรูป on it. Either
 * opens ถ่ายรูป (the phone's own camera) / เลือกจากคลังภาพ.
 */
function PhotoBox({ edit }: { edit: AffiliateFormState }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const open = () =>
    anchor.current?.measureInWindow((x, y, w, h) =>
      setAt({
        x: Math.min(edit.photo ? x + w - MENU_WIDTH - SPACE.m : x, width - MENU_WIDTH - SPACE.l),
        y: edit.photo ? y + h - SPACE.m : y + h + 6,
      }),
    );
  const choose = (source: "camera" | "library") => {
    setAt(null);
    edit.choosePhoto(source);
  };
  const photo = edit.photo;
  return (
    <>
      <View ref={anchor} collapsable={false} style={styles.photoWrap}>
        {photo ? (
          <View>
            <CardPhoto
              imageKey={photo.kind === "saved" ? photo.key : null}
              uri={photo.kind === "new" ? photo.uri : undefined}
              height={240}
              radius={RADIUS.card}
            />
            <Pressable
              onPress={open}
              accessibilityRole="button"
              style={[
                styles.change,
                { backgroundColor: theme.glass, borderColor: theme.glassLine },
              ]}
            >
              <LineIcon d={CAMERA_ICON} color={theme.text} size={17} strokeWidth={2} />
              <Text style={[TYPE.subhead, { color: theme.text }]}>
                {t({ th: "เปลี่ยนรูป", en: "Change photo" })}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={open}
            accessibilityRole="button"
            style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <LineIcon d={CAMERA_ICON} color={theme.primary} size={24} strokeWidth={2} />
            <Text style={[TYPE.footnote, { color: theme.primary }]}>
              {t({ th: "เพิ่มรูป", en: "Add photo" })}
            </Text>
          </Pressable>
        )}
      </View>
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
  photoWrap: { marginTop: SPACE.l, alignSelf: "stretch" },
  tile: {
    width: 96,
    height: 96,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  change: {
    position: "absolute",
    right: SPACE.m,
    bottom: SPACE.m,
    height: 34,
    paddingHorizontal: SPACE.m,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  store: { marginTop: SPACE.xl },
  choice: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: { width: 96 },
  value: { flex: 1, minWidth: 0 },
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
