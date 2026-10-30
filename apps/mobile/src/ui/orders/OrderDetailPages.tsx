import { orderStages, trackingUrl } from "@l-shopee/core";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import { stamp } from "@/lib/orderList";
import { addressLine } from "@/lib/orderPage";
import type { OrderDetail } from "@/lib/ordersApi";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { openPage } from "../openPage";
import type { ChromeToast } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE } from "../theme";
import { ICON } from "./icons";
import { LoadState, useFilePage } from "./OrderFilePages";
import { Group, Row, SectionTitle } from "./parts";
import { useOrderDetail } from "./useOrderDetail";

/**
 * The details the order page keeps short, each on a page of its own behind › (owner approved the
 * Shopee-style drawing, 29 Oct 2026): the money (payment, shipping fee, profit), the parcel with its
 * timeline, and the customer. They are sub-pages, so they have a back link and no tab bar.
 */

const COD = new Set(["cod", "cod_confirmed", "cod_collected", "cod_denied"]);

/** โอนเงิน / สลิป or เก็บเงินปลายทาง — how the customer pays. */
export function isCodOrder(paymentStatus: string | null): boolean {
  return COD.has(paymentStatus ?? "");
}

const DASH = "—";
const TOAST_MS = 2600;

function useSubPage(id: string) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : null;
  return useOrderDetail(id, token).load;
}

/** การชำระเงิน — the bill, the shipping fee behind it, and what the order made. */
export function PaymentScreen({ id }: { id: string }) {
  const { t } = useLang();
  const load = useSubPage(id);
  useFilePage(id, t({ th: "การชำระเงิน", en: "Payment" }), load);
  if (load.status !== "ready") return <LoadState load={load} />;
  const { order, money } = load.detail;
  const shortfall = money.shippingShortfallSatang;
  const shippingTotal =
    shortfall == null
      ? null
      : shortfall >= 0
        ? {
            label: t({ th: "ร้านออกค่าส่งให้", en: "Shipping on us" }),
            value: formatBaht(shortfall),
          }
        : { label: t({ th: "ได้กำไรค่าส่ง", en: "Shipping gain" }), value: formatBaht(-shortfall) };
  const profitShare =
    money.profitSatang != null && money.goodsAfterDiscountSatang > 0
      ? Math.round((money.profitSatang / money.goodsAfterDiscountSatang) * 100)
      : null;
  return (
    <View style={styles.body}>
      <Group>
        <Row
          label={t({ th: "วิธีชำระเงิน", en: "Payment" })}
          value={
            isCodOrder(order.paymentStatus)
              ? t({ th: "เก็บเงินปลายทาง", en: "Cash on delivery" })
              : t({ th: "โอนเงิน / สลิป", en: "Transfer / slip" })
          }
        />
        <Row
          label={t({ th: "ยอดสินค้า", en: "Subtotal" })}
          value={formatBaht(order.subtotalSatang)}
        />
        {order.discountTotalSatang > 0 && (
          <Row
            label={t({ th: "ส่วนลดคูปอง", en: "Coupon discount" })}
            value={`−${formatBaht(order.discountTotalSatang)}`}
          />
        )}
        <Row
          label={t({ th: "ค่าจัดส่ง", en: "Shipping" })}
          value={formatBaht(order.shippingFeeSatang)}
        />
        <Row
          label={t({ th: "ยอดรวมทั้งสิ้น", en: "Total" })}
          value={formatBaht(money.customerPaidSatang)}
          bold
          last
        />
      </Group>

      <SectionTitle text={t({ th: "ค่าจัดส่ง", en: "Shipping fee" })} />
      <Group>
        <Row
          label={t({ th: "คำนวณอัตโนมัติ", en: "Auto calculated" })}
          sub={t({ th: "จากระบบที่เชื่อมกับ Flash Express", en: "From the Flash Express link" })}
          value={formatBaht(order.shippingAutoSatang)}
        />
        {order.shippingOfferSatang != null && (
          <Row
            label={t({ th: "เสนอลูกค้า", en: "Offered" })}
            value={formatBaht(order.shippingOfferSatang)}
          />
        )}
        <Row
          label={t({ th: "เก็บจากลูกค้า", en: "Charged" })}
          value={formatBaht(order.shippingFeeSatang)}
        />
        <Row
          label={t({ th: "ค่าส่งจริง", en: "Real cost" })}
          sub={
            order.shippingRealSatang == null
              ? t({ th: "กรอกตอนบันทึกการส่งของ", en: "Recorded at drop-off" })
              : undefined
          }
          value={order.shippingRealSatang != null ? formatBaht(order.shippingRealSatang) : DASH}
          last={!shippingTotal}
        />
        {shippingTotal && <Row label={shippingTotal.label} value={shippingTotal.value} bold last />}
      </Group>

      <SectionTitle text={t({ th: "สรุปการเงิน", en: "Money summary" })} />
      <Group>
        <Row
          label={t({ th: "ยอดหลังหักส่วนลด", en: "After discount" })}
          value={formatBaht(money.goodsAfterDiscountSatang)}
        />
        <Row
          label={t({ th: "ต้นทุนสินค้า", en: "Item cost" })}
          value={formatBaht(money.itemCostSatang)}
        />
        {shippingTotal && (
          <Row
            label={shippingTotal.label}
            sub={
              order.shippingRealSatang != null
                ? t({
                    th: `จ่ายจริง ${formatBaht(order.shippingRealSatang)} − เก็บลูกค้า ${formatBaht(order.shippingFeeSatang)}`,
                    en: `Paid ${formatBaht(order.shippingRealSatang)} − charged ${formatBaht(order.shippingFeeSatang)}`,
                  })
                : undefined
            }
            value={shippingTotal.value}
          />
        )}
        <Row
          label={t({ th: "กำไร", en: "Profit" })}
          sub={
            profitShare != null
              ? t({ th: `${profitShare}% ของยอดสินค้า`, en: `${profitShare}% of goods` })
              : undefined
          }
          value={money.profitSatang != null ? formatBaht(money.profitSatang) : DASH}
          bold
          last
        />
      </Group>
    </View>
  );
}

/** การจัดส่ง — where it goes, the parcel in full, and its timeline. */
export function ShippingScreen({ id }: { id: string }) {
  const { t } = useLang();
  const load = useSubPage(id);
  const [toast, setToast] = useState<ChromeToast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useFilePage(id, t({ th: "การจัดส่ง", en: "Shipping" }), load, toast);
  if (load.status !== "ready") return <LoadState load={load} />;
  const { order, address } = load.detail;
  const track = trackingUrl(order.carrier, order.trackingNo);
  const copy = (text: string) => {
    void globalThis.navigator?.clipboard?.writeText(text);
    if (timer.current) clearTimeout(timer.current);
    setToast({
      title: t({ th: "คัดลอกเลขพัสดุแล้ว", en: "Tracking number copied" }),
      detail: text,
    });
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  };
  return (
    <View style={styles.body}>
      <Group>
        <Row
          label={[address?.recipientName, address?.phone].filter(Boolean).join(" · ") || DASH}
          sub={address ? addressLine(address) : undefined}
        />
        <Row label={t({ th: "ขนส่ง", en: "Carrier" })} value={order.carrier ?? DASH} />
        <Row
          label={t({ th: "เลขพัสดุ", en: "Tracking no." })}
          value={order.trackingNo ?? DASH}
          tool={
            order.trackingNo
              ? {
                  label: t({ th: "คัดลอกเลขพัสดุ", en: "Copy tracking number" }),
                  icon: ICON.copy,
                  onPress: () => copy(order.trackingNo!),
                }
              : undefined
          }
        />
        {track && (
          <Row
            label={t({ th: `ติดตามพัสดุที่ ${order.carrier}`, en: `Track at ${order.carrier}` })}
            onPress={() => openPage(track)}
          />
        )}
        <Row
          label={t({ th: "ส่งเมื่อ", en: "Shipped" })}
          value={order.shipTimeMs ? stamp(order.shipTimeMs) : DASH}
        />
        <Row
          label={t({ th: "ค่าส่งจริง", en: "Real cost" })}
          value={order.shippingRealSatang != null ? formatBaht(order.shippingRealSatang) : DASH}
          last
        />
      </Group>
      <SectionTitle text={t({ th: "ไทม์ไลน์", en: "Timeline" })} />
      <Timeline detail={load.detail} />
    </View>
  );
}

/** The order's steps as a line of dots: black done, red the one it is on, grey still to come. */
function Timeline({ detail }: { detail: OrderDetail }) {
  const { theme } = useTheme();
  const { order } = detail;
  const stages = orderStages(
    order.orderStatus,
    order.paymentStatus,
    detail.timeline.map((e) => ({ event: e.event, at: e.createdAt })),
  );
  return (
    <View style={[styles.timeline, { backgroundColor: theme.surface }]}>
      {stages.map((st, i) => {
        const color =
          st.state === "done"
            ? theme.text
            : st.state === "current"
              ? theme.primary
              : theme.textFaint;
        return (
          <View key={st.key} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.stepDot, { backgroundColor: color }]} />
              {i < stages.length - 1 && (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: st.state === "done" ? theme.text : theme.textFaint },
                  ]}
                />
              )}
            </View>
            <View style={styles.stepText}>
              <Text
                style={[
                  TYPE.body,
                  { color: st.state === "upcoming" ? theme.textMuted : theme.text },
                ]}
              >
                {st.label}
              </Text>
              {(st.at != null || st.note) && (
                <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
                  {[st.at != null ? stamp(st.at) : null, st.note].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** The buyer: how to reach them and their record, which decides cash on delivery. */
export function CustomerScreen({ id }: { id: string }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const load = useSubPage(id);
  const customer = load.status === "ready" ? load.detail.customer : null;
  const buyer = load.status === "ready" ? load.detail.order.buyerUsername : null;
  useFilePage(id, customer?.name ?? buyer ?? t({ th: "ลูกค้า", en: "Customer" }), load);
  if (load.status !== "ready") return <LoadState load={load} />;
  if (!customer) {
    return (
      <View style={styles.body}>
        <Group>
          <Row
            label={t({ th: "ไม่มีบัญชีหน้าร้าน", en: "No storefront account" })}
            value={buyer ?? DASH}
            last
          />
        </Group>
      </View>
    );
  }
  return (
    <View style={styles.body}>
      <Text style={[TYPE.subhead, styles.sub, { color: theme.textMuted }]}>
        {t({ th: "ลูกค้า AirPlus", en: "AirPlus customer" })}
      </Text>
      <Group>
        {/* Grey as drawn: red is for the main action only; โทรหาลูกค้า on the order page calls. */}
        <Row label={t({ th: "โทร", en: "Phone" })} value={customer.phone ?? DASH} />
        <Row
          label={t({ th: "รหัสลูกค้า", en: "Customer ID" })}
          value={customer.customerCode ?? DASH}
        />
        <Row label={t({ th: "ระดับลูกค้า", en: "Tier" })} value={customer.tier ?? DASH} />
        <Row
          label={t({ th: "ออเดอร์ที่ผ่านมา", en: "Past orders" })}
          value={t({
            th: `สำเร็จ ${customer.completeCount} · ไม่สำเร็จ ${customer.incompleteCount}`,
            en: `${customer.completeCount} done · ${customer.incompleteCount} not`,
          })}
          last
        />
      </Group>
      <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>
        {t({
          th: "ระดับลูกค้ามาจากออเดอร์ที่สำเร็จและไม่สำเร็จ ใช้ตัดสินใจอนุมัติเก็บเงินปลายทาง",
          en: "The tier comes from finished and unfinished orders; it decides cash on delivery",
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: SPACE.m },
  sub: { marginTop: -SPACE.m, marginBottom: SPACE.m, paddingHorizontal: 2 },
  note: { marginTop: SPACE.s, marginHorizontal: SPACE.l },
  timeline: {
    borderRadius: RADIUS.card,
    paddingVertical: SPACE.s,
    paddingHorizontal: SPACE.l,
  },
  step: { flexDirection: "row", gap: SPACE.m },
  rail: { width: 14, alignItems: "center" },
  stepDot: { marginTop: 15, width: 12, height: 12, borderRadius: 6 },
  line: { flex: 1, width: 2 },
  stepText: { flex: 1, paddingVertical: SPACE.s },
});
