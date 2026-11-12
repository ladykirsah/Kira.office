import { useLocalSearchParams } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { API_BASE } from "@/lib/config";
import { choicePhoto } from "@/lib/productChoices";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { TRASH_ICON } from "../flash/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { SPACE, TYPE } from "../theme";
import { FormPage } from "./FormPage";
import { InputRow } from "./parts";
import { CAMERA_ICON, MENU_WIDTH_PX, PhotoMenu } from "./PhotoStrip";
import { Prices, StockSteppers } from "./ProductFields";
import { ScanCodeSheet } from "./ScanCodeSheet";
import { useChoiceForm, type ChoiceFormState } from "./useChoiceForm";

const PHOTO = 76;

/** แก้ไขตัวเลือก — /products/:id/choices/:variantId/edit. */
export function EditChoiceScreen() {
  const { id = "", variantId = "" } = useLocalSearchParams<{ id: string; variantId: string }>();
  return <ChoiceFormScreen productId={id} variantId={variantId} />;
}

/** A new choice, empty — /products/:id/choices/new (＋ เพิ่มตัวเลือก once choices exist). */
export function NewChoiceScreen() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  return <ChoiceFormScreen productId={id} variantId={null} />;
}

/**
 * The choice's form (board ChoicesGroup row 1, "แตะ แก้ไข → ฟอร์มของขนาด · รูปเดียว"): its one photo
 * with the camera mark, ชื่อตัวเลือก and รหัสสินค้า (type or scan), the price list as แก้ไขสินค้า draws
 * it, ขายได้ / งานนอก, and 🗑 เอาตัวเลือกนี้ออก for one never sold. บันทึก is pinned at the bottom.
 */
function ChoiceFormScreen({
  productId,
  variantId,
}: {
  productId: string;
  variantId: string | null;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const form = useChoiceForm(productId, variantId);
  const [scanning, setScanning] = useState(false);
  const [removing, setRemoving] = useState(false);
  const title = variantId
    ? t({ th: "แก้ไขตัวเลือก", en: "Edit choice" })
    : t({ th: "เพิ่มตัวเลือก", en: "Add a choice" });

  if (!form.form || !form.detail) {
    return (
      <FormPage title={title} onCancel={form.leave}>
        {form.failed ? (
          <Text style={[TYPE.subhead, { color: theme.text }]}>
            {t({
              th: "โหลดตัวเลือกนี้ไม่ได้ ลองอีกครั้ง",
              en: "This choice did not load. Try again",
            })}
          </Text>
        ) : (
          <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
        )}
      </FormPage>
    );
  }
  const f = form.form;
  const canRemove = !!form.choice && !form.choice.inUse && (form.detail.choices?.length ?? 0) > 1;
  return (
    <FormPage
      title={title}
      onCancel={form.leave}
      save={{ label: t({ th: "บันทึก", en: "Save" }), onPress: () => void form.save() }}
      toast={form.toast ? { title: t(form.toast.title), detail: t(form.toast.detail) } : null}
    >
      <PhotoTile form={form} />
      <View style={styles.firstGroup}>
        <Group>
          <InputRow
            label={t({ th: "ชื่อตัวเลือก", en: "Choice name" })}
            value={f.value}
            placeholder={t({ th: "เช่น 3/8 เล็ก", en: "e.g. 3/8 small" })}
            onChange={(value) => form.set({ value })}
            error={form.errors.value && t(form.errors.value)}
          />
          <InputRow
            label={t({ th: "รหัสสินค้า", en: "Code" })}
            value={f.code}
            placeholder={t({ th: "พิมพ์หรือสแกน", en: "Type or scan" })}
            onChange={(code) => form.set({ code })}
            error={form.errors.code && t(form.errors.code)}
            last
            tool={
              <Pressable
                onPress={() => setScanning(true)}
                accessibilityRole="button"
                accessibilityLabel={t({ th: "สแกนรหัสสินค้า", en: "Scan the code" })}
                hitSlop={8}
              >
                <LineIcon d={ICON.scan} color={theme.textMuted} size={18} strokeWidth={1.8} />
              </Pressable>
            }
          />
        </Group>
      </View>
      <Prices edit={form} blank="—" />
      <View>
        <Text
          style={[TYPE.title2, styles.heading, { color: theme.text }]}
          accessibilityRole="header"
        >
          {t({ th: "สต็อก", en: "Stock" })}
        </Text>
        <Group>
          <StockSteppers edit={form} />
        </Group>
      </View>
      {canRemove && (
        <View style={styles.removeGroup}>
          <Group>
            <Pressable
              onPress={() => setRemoving(true)}
              accessibilityRole="button"
              style={styles.removeRow}
            >
              <LineIcon d={TRASH_ICON} color={theme.danger} size={18} strokeWidth={1.9} />
              <Text style={[TYPE.body, { color: theme.danger }]}>
                {t({ th: "เอาตัวเลือกนี้ออก", en: "Remove this choice" })}
              </Text>
            </Pressable>
          </Group>
        </View>
      )}
      {scanning && (
        <ScanCodeSheet
          onClose={() => setScanning(false)}
          onCode={(code) => {
            setScanning(false);
            form.set({ code });
          }}
        />
      )}
      {removing && form.choice && (
        <Sheet
          title={t({ th: `ลบ ${form.choice.value}?`, en: `Delete ${form.choice.value}?` })}
          onClose={() => setRemoving(false)}
          noPill
        >
          <BigButton
            label={t({ th: "ลบ", en: "Delete" })}
            onPress={() => {
              setRemoving(false);
              void form.remove();
            }}
          />
          <BigButton
            label={t({ th: "ยกเลิก", en: "Cancel" })}
            kind="grey"
            onPress={() => setRemoving(false)}
          />
        </Sheet>
      )}
    </FormPage>
  );
}

/** The choice's one photo, square, with the camera mark on its corner; a tap offers the two sources. */
function PhotoTile({ form }: { form: ChoiceFormState }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const saved = form.choice
    ? choicePhoto(form.choice, form.detail!.product.imageKey)
    : form.detail!.product.imageKey;
  const uri = form.photo?.uri || (saved ? `${API_BASE}/img/${saved}` : null);
  const open = () =>
    anchor.current?.measureInWindow((x, y, _w, h) =>
      setAt({ x: Math.min(x, width - MENU_WIDTH_PX - SPACE.l), y: y + h + 6 }),
    );
  return (
    <View ref={anchor} collapsable={false} style={styles.photoWrap}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t({ th: "เปลี่ยนรูป", en: "Change the photo" })}
      >
        {uri ? (
          <Image source={{ uri }} style={[styles.photo, { backgroundColor: theme.hover }]} />
        ) : (
          <View style={[styles.photo, { backgroundColor: theme.hover }]} />
        )}
        <View style={[styles.badge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <LineIcon d={CAMERA_ICON} color={theme.text} size={14} strokeWidth={1.9} />
        </View>
      </Pressable>
      <PhotoMenu
        at={at}
        onClose={() => setAt(null)}
        onPick={(source) => {
          setAt(null);
          form.pick(source);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photoWrap: { alignSelf: "flex-start", paddingTop: SPACE.s },
  photo: { width: PHOTO, height: PHOTO, borderRadius: 12 },
  badge: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  firstGroup: { marginTop: SPACE.xl },
  heading: { marginTop: SPACE.xxl, marginBottom: SPACE.m, marginHorizontal: 2 },
  removeGroup: { marginTop: SPACE.xxl },
  removeRow: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
});
