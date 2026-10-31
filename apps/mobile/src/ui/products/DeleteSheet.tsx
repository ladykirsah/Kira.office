import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { API_BASE } from "@/lib/config";
import { deleteProduct } from "@/lib/productsApi";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { TYPE } from "../theme";
import { InputRow } from "./parts";
import type { ProductPage } from "./useProductPage";

const CONFIRM_WORD = "ลบ";

/**
 * ลบสินค้า. The owner's rule (24 Aug 2026, kept 31 Oct): delete = gone, and only a product that was
 * never sold or stock-counted can go. Any other is turned off instead (AirPlus off in แก้ไข), so its
 * sales and stock history stay whole — the sheet says so rather than greying the button.
 */
export function DeleteSheet({ page, onClose }: { page: ProductPage; onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const d = page.detail!;
  // Stock on hand or out on jobs means stock movements, which the server never lets go.
  const [blocked, setBlocked] = useState(d.onHand !== 0 || d.held !== 0);
  const [typed, setTyped] = useState("");
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);

  if (blocked) {
    return (
      <Sheet
        title={t({ th: "ลบสินค้านี้ไม่ได้", en: "This product can't be deleted" })}
        noPill
        onClose={onClose}
      >
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {t({
            th: "สินค้านี้เคยขายหรือเคยนับสต็อกแล้ว ถ้าไม่ขายแล้ว ให้ปิด AirPlus ในหน้าแก้ไขแทน ประวัติจะยังอยู่ครบ",
            en: "This product has been sold or stock-counted. To stop selling it, turn AirPlus off in Edit instead; its history stays whole.",
          })}
        </Text>
        <BigButton label={t({ th: "เข้าใจแล้ว", en: "Got it" })} kind="grey" onPress={onClose} />
      </Sheet>
    );
  }

  const remove = async () => {
    if (typed.trim() !== CONFIRM_WORD) {
      setWrong(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const done = await deleteProduct(fetch, API_BASE, page.token, d.product.id);
      if (done === "has_history") {
        setBlocked(true);
        return;
      }
      onClose();
      router.replace("/products" as never);
    } catch (e) {
      onClose();
      const why = e instanceof Error ? e.message : "";
      page.showToast(
        { th: "ลบไม่สำเร็จ", en: "Not deleted" },
        { th: why || "ลองอีกครั้ง", en: why || "Try again" },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t({ th: "ลบสินค้า", en: "Delete product" })} onClose={onClose}>
      <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
        {t({
          th: "ลบแล้วสินค้าหายจากทุกหน้าและเลิกขายบน AirPlus · เอาคืนไม่ได้",
          en: "Deleting removes it from every page and from AirPlus. It cannot be undone.",
        })}
      </Text>
      <Group>
        <InputRow
          label={t({ th: "พิมพ์ ลบ", en: "Type ลบ" })}
          value={typed}
          placeholder={t({ th: "พิมพ์ ลบ เพื่อยืนยัน", en: "Type ลบ to confirm" })}
          onChange={(v) => {
            setTyped(v);
            setWrong(false);
          }}
          last
        />
      </Group>
      {wrong && <FieldError text={t({ th: "พิมพ์คำว่า ลบ ก่อน", en: "Type ลบ first" })} />}
      <BigButton
        label={t({ th: "ลบสินค้า", en: "Delete product" })}
        onPress={() => void remove()}
      />
    </Sheet>
  );
}
