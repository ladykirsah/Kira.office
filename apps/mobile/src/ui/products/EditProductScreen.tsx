import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text } from "react-native";
import { hasChoices } from "@/lib/productChoices";
import { useLang, useTheme } from "../AppProviders";
import { Empty } from "../customers/parts";
import { useWide } from "../desk/useWide";
import { ICON } from "../orders/icons";
import { SPACE, TYPE } from "../theme";
import { DeskProductFields } from "./DeskProductFields";
import { FormPage } from "./FormPage";
import { ProductFields } from "./ProductFields";
import { useProductEdit } from "./useProductEdit";

/**
 * แก้ไขสินค้า (canvas v194): everything on one page — photos, name and code, cost and prices, stock,
 * cars, the part's details, the description and where it is sold — saved by the pinned บันทึก.
 * Sell prices and the two shop switches are the owner's; others see them as plain values. A
 * computer opens it inside the frame under ‹ สินค้า, in two columns (DeskAddProduct board).
 */
export function EditProductScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const edit = useProductEdit(id);
  const wide = useWide();
  const back = t({ th: "สินค้า", en: "Products" });
  const title = t({ th: "แก้ไขสินค้า", en: "Edit product" });

  if (!edit.rights.edits) {
    return (
      <FormPage title={title} back={back} onCancel={edit.leave}>
        <Empty
          icon={ICON.alert}
          title={t({
            th: "แก้ไขสินค้าได้เฉพาะเจ้าของร้านและแอดมิน",
            en: "Only the owner and admins edit products",
          })}
          detail={t({
            th: "นับสต็อกได้จากปุ่ม สต็อกและราคา",
            en: "Stock can be counted from Stock & prices",
          })}
        />
      </FormPage>
    );
  }
  if (!edit.form || !edit.detail) {
    return (
      <FormPage title={title} back={back} onCancel={edit.leave}>
        {edit.failed ? (
          <Text style={[TYPE.subhead, { color: theme.text }]}>
            {t({
              th: "โหลดสินค้านี้ไม่ได้ ลองอีกครั้ง",
              en: "This product did not load. Try again",
            })}
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
      back={back}
      onCancel={edit.leave}
      save={{ label: t({ th: "บันทึก", en: "Save" }), onPress: () => void edit.save() }}
      toast={edit.toast ? { title: t(edit.toast.title), detail: t(edit.toast.detail) } : null}
    >
      {wide ? (
        <DeskProductFields edit={edit} mode="edit" withChoices={hasChoices(edit.detail)} />
      ) : (
        <ProductFields edit={edit} mode="edit" withChoices={hasChoices(edit.detail)} />
      )}
    </FormPage>
  );
}
