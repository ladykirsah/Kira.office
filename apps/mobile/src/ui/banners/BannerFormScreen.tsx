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
import { addTitle, choiceLabel, rowName, windowLabel } from "@/lib/bannerPage";
import { useLang, useTheme } from "../AppProviders";
import { CAMERA_ICON } from "../affiliate/parts";
import { BigButton } from "../BigButton";
import { Empty } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { ChoiceRow, FieldError } from "../pos/fields";
import { FormPage } from "../products/FormPage";
import { SwitchRow } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { GoToSheets, ProductLine, linkNames } from "./GoToSheets";
import { BANNER_RATIO, BannerPicture, PICTURE_ICON, PICTURE_RADIUS } from "./parts";
import { useBannerForm, type BannerFormState } from "./useBannerForm";
import { WhenSheet } from "./WhenSheet";

const ALBUM_ICON = "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5h.01";
const MENU_WIDTH = 250;

/** เพิ่มสไลด์ / เพิ่มแถบโปรโมชัน (no id) or แก้ (สไลด์ 1, แถบ 2) — one form (canvas v245). */
export function BannerFormScreen() {
  const { id, slot } = useLocalSearchParams<{ id?: string; slot?: string }>();
  const { t } = useLang();
  const { theme } = useTheme();
  const edit = useBannerForm(id ?? null, slot === "promo" ? "promo" : "hero");
  const formSlot = edit.form?.slot ?? (slot === "promo" ? "promo" : "hero");
  const title = edit.isNew
    ? t(addTitle(formSlot))
    : edit.index >= 0
      ? t(rowName(formSlot, edit.index))
      : t({ th: "แก้แบนเนอร์", en: "Edit banner" });

  if (!edit.form || !edit.banners) {
    return (
      <FormPage
        title={title}
        back={t({ th: "แบนเนอร์", en: "Banners" })}
        deskLayout="column"
        onCancel={edit.leave}
      >
        {edit.problem === "gone" ? (
          <Empty
            icon={ICON.search}
            title={t({ th: "ไม่มีแบนเนอร์นี้แล้ว", en: "This banner is gone" })}
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
      back={t({ th: "แบนเนอร์", en: "Banners" })}
      deskLayout="column"
      onCancel={edit.leave}
      save={{ label: t({ th: "บันทึก", en: "Save" }), onPress: () => void edit.save() }}
      toast={edit.toast ? { title: t(edit.toast.title), detail: t(edit.toast.detail) } : null}
    >
      <Fields edit={edit} title={title} />
    </FormPage>
  );
}

function Fields({ edit, title }: { edit: BannerFormState; title: string }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const f = edit.form!;
  const names = linkNames(edit.lists);
  const productId = f.link.kind === "product" ? f.link.id : null;
  const product = productId ? edit.lists?.products.find((p) => p.id === productId) : undefined;
  const openGoTo = () => edit.setSheet("goto");
  return (
    <>
      <PictureBox edit={edit} />
      {edit.errors.photo && <FieldError text={t(edit.errors.photo)} />}

      <View style={styles.cards}>
        <Group>
          {f.link.kind === "product" ? (
            <>
              <ChoiceRow
                label={t({ th: "ไปที่", en: "Goes to" })}
                value={t({ th: "สินค้า", en: "Product" })}
                onPress={openGoTo}
              />
              {product ? (
                <ProductLine product={product} onPress={openGoTo} last />
              ) : (
                <ChoiceRow label={t(choiceLabel(f.link, names))} onPress={openGoTo} last />
              )}
            </>
          ) : (
            <ChoiceRow
              label={t({ th: "ไปที่", en: "Goes to" })}
              value={t(choiceLabel(f.link, names))}
              onPress={openGoTo}
              last
            />
          )}
        </Group>

        <Group>
          <ChoiceRow
            label={t({ th: "ช่วงเวลา", en: "When" })}
            value={t(windowLabel(f.startsAt, f.endsAt))}
            onPress={() => edit.setSheet("when")}
            last={edit.isNew}
          />
          {!edit.isNew && (
            <SwitchRow
              label={t({ th: "เปิดใช้", en: "On" })}
              value={f.on}
              onChange={(on) => edit.set({ on })}
              last
            />
          )}
        </Group>
        {edit.errors.when && <FieldError text={t(edit.errors.when)} />}

        {!edit.isNew && (
          <Group>
            <Pressable
              onPress={() => edit.setSheet("delete")}
              accessibilityRole="button"
              style={styles.deleteRow}
            >
              <Text style={[TYPE.body, { color: theme.danger }]}>
                {t({ th: "ลบแบนเนอร์", en: "Delete banner" })}
              </Text>
            </Pressable>
          </Group>
        )}
      </View>

      {edit.sheet === "goto" && (
        <GoToSheets
          current={f.link}
          lists={edit.lists}
          listsFailed={edit.listsFailed}
          onRetry={() => void edit.loadLists()}
          onPick={(link) => {
            edit.set({ link });
            edit.setSheet(null);
          }}
          onClose={() => edit.setSheet(null)}
        />
      )}
      {edit.sheet === "when" && (
        <WhenSheet
          startsAt={f.startsAt}
          endsAt={f.endsAt}
          onApply={(w) => {
            edit.set(w);
            edit.setSheet(null);
          }}
          onClose={() => edit.setSheet(null)}
        />
      )}
      {edit.sheet === "delete" && (
        <Sheet
          title={t({ th: `ลบ${title}?`, en: `Delete ${title}?` })}
          onClose={() => edit.setSheet(null)}
          noPill
        >
          <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={() => void edit.remove()} />
          <BigButton
            label={t({ th: "ยกเลิก", en: "Cancel" })}
            kind="grey"
            onPress={() => edit.setSheet(null)}
          />
        </Sheet>
      )}
    </>
  );
}

/**
 * No picture yet: the เลือกรูป · กว้าง 16:6 tile. With one: the picture, and เปลี่ยนรูป under it.
 * Either opens ถ่ายรูป (the phone's own camera) / เลือกจากคลังภาพ.
 */
function PictureBox({ edit }: { edit: BannerFormState }) {
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
    edit.choosePhoto(source);
  };
  const photo = edit.photo;
  return (
    <>
      <View style={styles.pictureWrap}>
        {photo ? (
          <>
            <BannerPicture
              imageKey={photo.kind === "saved" ? photo.key : null}
              uri={photo.kind === "new" ? photo.uri : undefined}
            />
            <View ref={anchor} collapsable={false} style={styles.changeWrap}>
              <Pressable
                onPress={open}
                accessibilityRole="button"
                style={[styles.change, { backgroundColor: theme.hover }]}
              >
                <Text style={[TYPE.subhead, { color: theme.text }]}>
                  {t({ th: "เปลี่ยนรูป", en: "Change picture" })}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View ref={anchor} collapsable={false}>
            <Pressable
              onPress={open}
              accessibilityRole="button"
              style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <LineIcon d={PICTURE_ICON} color={theme.primary} size={28} strokeWidth={1.8} />
              <Text style={[styles.tileText, { color: theme.primary }]}>
                {t({ th: "เลือกรูป · กว้าง 16:6", en: "Pick a picture · 16:6 wide" })}
              </Text>
            </Pressable>
          </View>
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
  pictureWrap: { marginTop: SPACE.l, alignSelf: "stretch" },
  tile: {
    width: "100%",
    aspectRatio: BANNER_RATIO,
    borderRadius: PICTURE_RADIUS,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tileText: { fontSize: 15 },
  changeWrap: { marginTop: SPACE.s, alignSelf: "flex-start" },
  change: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center" },
  cards: { marginTop: SPACE.xxl, gap: SPACE.l },
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
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
