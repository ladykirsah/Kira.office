import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { reprintBill } from "@/lib/billReprint";
import { lineSub, longDate, payWord } from "@/lib/customerPage";
import { formatBaht } from "@/lib/money";
import { useLang, useTheme } from "../AppProviders";
import { Group, Row, SectionTitle } from "../orders/parts";
import { BillDoc } from "../pos/BillDoc";
import { usePos } from "../pos/PosSessionProvider";
import { shareDoc } from "../pos/saveDoc";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { useCarPage } from "./useCarPage";

/** หน้าบิล (canvas v151): one visit's items with brand, price × quantity and total; พิมพ์ซ้ำ / ส่ง. */
export function BillScreen() {
  const { t, lang } = useLang();
  const { theme } = useTheme();
  const { plate = "", bill = "" } = useLocalSearchParams<{ plate: string; bill: string }>();
  const page = useCarPage(plate);
  const pos = usePos();
  const node = useRef<ComponentRef<typeof View>>(null);
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(null);
  const sale = page.detail?.history.find((s) => s.id === bill) ?? null;
  const shownPlate = page.detail?.customer?.licensePlate ?? plate;

  const send = () => {
    if (!node.current || !sale) return;
    shareDoc(node.current, `${sale.saleNumber ?? "bill"}.png`).catch((e: Error) =>
      setToast({ title: t({ th: "ทำไม่ได้", en: "Could not do it" }), detail: e.message }),
    );
  };

  useScreenChrome(
    null,
    sale ? [{ label: t({ th: "พิมพ์ซ้ำ / ส่ง", en: "Reprint / send" }), onPress: send }] : [],
    {
      back: {
        label: shownPlate,
        onPress: () =>
          router.canGoBack()
            ? router.back()
            : router.replace(`/customers/${encodeURIComponent(plate)}` as never),
      },
      ownTitle: true,
      toast,
    },
  );

  if (!sale) {
    return page.detail || page.failed ? (
      <Text style={[TYPE.subhead, styles.gone, { color: theme.textMuted }]}>
        {t({ th: "ไม่พบบิลนี้", en: "This bill was not found" })}
      </Text>
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  const paid = payWord(sale.paymentMethod);
  return (
    <View>
      <Text
        style={[TYPE.largeTitle, styles.title, { color: theme.text }]}
        accessibilityRole="header"
      >
        {t(longDate(sale.createdAt))}
      </Text>
      {sale.saleNumber && (
        <Text style={[TYPE.subhead, styles.sub, { color: theme.textMuted }]}>
          {sale.saleNumber}
        </Text>
      )}
      <SectionTitle text={t({ th: "รายการ", en: "Items" })} />
      <Group>
        {sale.lines.map((l, i) => (
          <Row
            key={`${i}-${l.description}`}
            label={l.description}
            sub={t(lineSub(l))}
            // The line's own amount; its discountSatang is a share of the ส่วนลด row below.
            value={formatBaht(l.unitPriceSatang * l.quantity)}
          />
        ))}
        {sale.discountTotalSatang > 0 && (
          <Row
            label={t({ th: "ส่วนลด", en: "Discount" })}
            value={`−${formatBaht(sale.discountTotalSatang)}`}
          />
        )}
        <Row
          label={t({ th: "รวมทั้งสิ้น", en: "Total" })}
          value={formatBaht(sale.grandTotalSatang)}
          bold
          last
        />
      </Group>
      {(paid || sale.mileageKm !== null) && (
        <>
          <SectionTitle text={t({ th: "การชำระเงิน", en: "Payment" })} />
          <Group>
            {paid && (
              <Row
                label={t({ th: "ชำระโดย", en: "Paid by" })}
                value={t(paid)}
                last={sale.mileageKm === null}
              />
            )}
            {sale.mileageKm !== null && (
              <Row
                label={t({ th: "เลขไมล์", en: "Mileage" })}
                value={`${sale.mileageKm.toLocaleString("en-US")} ${t({ th: "กม.", en: "km" })}`}
                last
              />
            )}
          </Group>
        </>
      )}
      {/* The paper พิมพ์ซ้ำ / ส่ง makes, drawn off screen (the drawing shows the details, not the paper). */}
      <View style={styles.offscreen} pointerEvents="none" aria-hidden>
        <BillDoc
          doc={reprintBill(sale, page.detail!.customer, { shopName: pos.data.shopName, lang })}
          ref={node}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: SPACE.s, marginHorizontal: 2 },
  sub: { marginHorizontal: 2 },
  gone: { marginTop: SPACE.xxl, textAlign: "center" },
  offscreen: { position: "absolute", left: -10000, top: 0, width: 380 },
});
