import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { carryLine } from "@/lib/productAdd";
import { useLang, useTheme } from "../AppProviders";
import { Empty } from "../customers/parts";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { SPACE, TYPE } from "../theme";
import { FormPage } from "./FormPage";
import { ProductFields } from "./ProductFields";
import { useProductAdd, type ProductAdd } from "./useProductAdd";

/**
 * เพิ่มสินค้า (canvas v196): the edit form, started empty, under ปิด and the pinned บันทึก. After
 * บันทึก it starts again for the next product with ยกมาจากชิ้นก่อน on top; ล้าง empties that.
 * A code searched on สินค้า and not found arrives filled in.
 */
export function AddProductScreen() {
  const { t } = useLang();
  const { code = "" } = useLocalSearchParams<{ code?: string }>();
  const add = useProductAdd(code);
  const title = t({ th: "เพิ่มสินค้า", en: "Add product" });
  const closeLabel = t({ th: "ปิด", en: "Close" });

  if (!add.rights.edits) {
    return (
      <FormPage title={title} cancelLabel={closeLabel} onCancel={() => void add.close()}>
        <Empty
          icon={ICON.alert}
          title={t({
            th: "เพิ่มสินค้าได้เฉพาะเจ้าของร้านและแอดมิน",
            en: "Only the owner and admins add products",
          })}
          detail={t({
            th: "นับสต็อกได้จากปุ่ม สต็อกและราคา",
            en: "Stock can be counted from Stock & prices",
          })}
        />
      </FormPage>
    );
  }
  return (
    <FormPage
      title={title}
      cancelLabel={closeLabel}
      onCancel={() => void add.close()}
      note={add.note ? t(add.note) : null}
      scrollKey={add.round}
      save={{ label: t({ th: "บันทึก", en: "Save" }), onPress: () => void add.save() }}
      toast={add.toast ? { title: t(add.toast.title), detail: t(add.toast.detail) } : null}
    >
      {add.carry && <Carried add={add} />}
      <ProductFields edit={add} mode="add" onAutoName={add.nameIt} />
    </FormPage>
  );
}

/** ยกมาจากชิ้นก่อน: what the last product handed on, and ล้าง to start empty. */
function Carried({ add }: { add: ProductAdd }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View style={styles.carried}>
      <Group>
        <View style={styles.row}>
          <View style={styles.words}>
            <Text style={[TYPE.body, { color: theme.text }]}>
              {t({ th: "ยกมาจากชิ้นก่อน", en: "Carried from the last one" })}
            </Text>
            <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
              {t(carryLine(add.carry!, add.attrs))}
            </Text>
          </View>
          <Pressable onPress={add.clearCarry} accessibilityRole="button" hitSlop={10}>
            <Text style={[TYPE.body, { color: theme.primary }]}>
              {t({ th: "ล้าง", en: "Clear" })}
            </Text>
          </Pressable>
        </View>
      </Group>
    </View>
  );
}

const styles = StyleSheet.create({
  carried: { marginBottom: SPACE.l },
  row: {
    minHeight: 68,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  words: { flex: 1, gap: 2 },
});
