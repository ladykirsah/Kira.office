import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { copyText } from "@/lib/copyText";
import {
  COPIED_TOAST,
  USED_TOAST,
  canDelete,
  couponState,
  creatorName,
  pageWindow,
  stateLine,
  usedShare,
  usedValue,
  type Coupon,
} from "@/lib/couponPage";
import { whoLine } from "@/lib/couponRules";
import { deleteCoupon } from "@/lib/couponsApi";
import { formatBaht } from "@/lib/money";
import { dayPill } from "@/lib/orderList";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { BigButton } from "../BigButton";
import { Empty } from "../customers/parts";
import { useWide } from "../desk/useWide";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { Divider, Line } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { CouponFace, StateDot } from "./parts";
import { useCouponList } from "./useCouponList";

const BASE = "/settings/coupons";

/**
 * One coupon (canvas v266): its name, card C with the code to copy, then how it stands — สถานะ,
 * ใช้ไปแล้ว with its bar, the limits, ใครใช้ได้, ช่วงเวลา (or a ลูกค้าใหม่ coupon's สมัครช่วง), and who
 * made it when; the card's สำหรับ… line says what it is for. แก้ไข opens the form; ลบคูปอง asks first,
 * and says no for one already used.
 */
export function CouponScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const list = useCouponList();
  const [deleting, setDeleting] = useState(false);
  const wide = useWide();
  const coupon = list.coupons?.find((c) => c.id === id) ?? null;

  useScreenChrome(null, [], {
    back: {
      label: t({ th: "คูปอง", en: "Coupons" }),
      onPress: () => (router.canGoBack() ? router.back() : router.replace(BASE as never)),
    },
    ownTitle: true,
    toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null,
  });

  if (!list.coupons) {
    return list.failed ? (
      <Retry onPress={() => void list.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  if (!coupon) {
    return (
      <Empty
        icon={ICON.search}
        title={t({ th: "ไม่มีคูปองนี้แล้ว", en: "This coupon is gone" })}
        detail={t({ th: "อาจถูกลบไปแล้ว", en: "It may have been deleted" })}
      />
    );
  }

  const copy = async () => {
    if (await copyText(coupon.code)) list.showToast(COPIED_TOAST(coupon.code));
    else list.showToast({ th: "คัดลอกไม่ได้", en: "Could not copy" });
  };
  // A used coupon is part of the shop's sales: say so straight away instead of asking.
  const askDelete = () =>
    coupon.redemptions > 0
      ? list.showToast(USED_TOAST.title, USED_TOAST.detail)
      : setDeleting(true);

  const head = (
    <>
      <Pressable
        onPress={() => router.push(`${BASE}/${encodeURIComponent(coupon.id)}/edit` as never)}
        accessibilityRole="button"
        style={[styles.editPill, { backgroundColor: theme.glass, borderColor: theme.glassLine }]}
      >
        <Text style={[TYPE.body, { color: theme.text }]}>{t({ th: "แก้ไข", en: "Edit" })}</Text>
      </Pressable>
      <Text style={[TYPE.title1, styles.name, { color: theme.text }]} accessibilityRole="header">
        {coupon.name || coupon.code}
      </Text>
    </>
  );
  const ticket = (
    <View style={wide ? null : styles.card}>
      <CouponFace coupon={coupon} radius={wide ? 16 : 20} padding={wide ? 20 : 16}>
        <View style={styles.codeRow}>
          <Text style={[styles.code, styles.grow, { color: theme.text }]} numberOfLines={1}>
            {coupon.code}
          </Text>
          <Pressable
            onPress={() => void copy()}
            accessibilityRole="button"
            accessibilityLabel={t({ th: "คัดลอกโค้ด", en: "Copy the code" })}
            style={styles.copy}
          >
            <LineIcon d={ICON.copy} color={theme.text} size={18} strokeWidth={2} />
          </Pressable>
        </View>
      </CouponFace>
    </View>
  );
  const remove = (
    <View style={styles.deleteGroup}>
      <Group>
        <Pressable onPress={askDelete} accessibilityRole="button" style={styles.deleteRow}>
          <Text style={[TYPE.body, { color: theme.danger }]}>
            {t({ th: "ลบคูปอง", en: "Delete coupon" })}
          </Text>
        </Pressable>
      </Group>
    </View>
  );
  const sheet = deleting && (
    <DeleteSheet
      coupon={coupon}
      token={list.token}
      onClose={() => setDeleting(false)}
      onUsed={() => list.showToast(USED_TOAST.title, USED_TOAST.detail)}
      onFailed={(why) =>
        list.showToast(
          { th: "ลบไม่สำเร็จ", en: "Not deleted" },
          { th: why || "ลองอีกครั้ง", en: why || "Try again" },
        )
      }
    />
  );

  if (wide) {
    // A computer (DeskCoupons board 2): the ticket on the left, how it stands on the right; a coupon
    // someone has used has no ลบคูปอง (in use = no delete).
    return (
      <View>
        {head}
        <View style={styles.wideRow}>
          <View style={styles.wideLeft}>{ticket}</View>
          <View style={styles.wideRight}>
            <Facts coupon={coupon} flush />
            {canDelete(coupon) && remove}
          </View>
        </View>
        {sheet}
      </View>
    );
  }
  return (
    <View>
      {head}
      {ticket}
      <Facts coupon={coupon} />
      {remove}
      {sheet}
    </View>
  );
}

/** The rows under the ticket, values in black on the right (as drawn). */
function Facts({ coupon, flush }: { coupon: Coupon; flush?: boolean }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const now = Date.now();
  const share = usedShare(coupon);
  const value = (text: string) => (
    <Text style={[TYPE.body, styles.value, { color: theme.text }]} numberOfLines={1}>
      {text}
    </Text>
  );
  return (
    <View style={flush ? null : styles.facts}>
      <Group>
        <Line
          label={t({ th: "สถานะ", en: "Status" })}
          right={
            <View style={styles.state}>
              <StateDot state={couponState(coupon, now)} />
              {value(t(stateLine(coupon, now)))}
            </View>
          }
        />
        <View style={styles.used}>
          <View style={styles.usedHead}>
            <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>
              {t({ th: "ใช้ไปแล้ว", en: "Used" })}
            </Text>
            {value(t(usedValue(coupon)))}
          </View>
          {share != null && (
            <View style={[styles.bar, { backgroundColor: theme.bg }]}>
              <View
                style={[styles.fill, { width: `${share * 100}%`, backgroundColor: theme.text }]}
              />
            </View>
          )}
        </View>
        <Divider />
        <Line
          label={t({ th: "ใช้ได้ต่อคน", en: "Per customer" })}
          right={value(
            t({
              th: `${coupon.maxUsesPerCustomer} ครั้ง`,
              en: `${coupon.maxUsesPerCustomer} times`,
            }),
          )}
        />
        <Line
          label={t({ th: "ซื้อขั้นต่ำ", en: "Minimum" })}
          right={value(coupon.minSubtotalSatang > 0 ? formatBaht(coupon.minSubtotalSatang) : "—")}
        />
        <Line label={t({ th: "ใครใช้ได้", en: "Who" })} right={value(t(whoLine(coupon, true)))} />
        {coupon.signupFrom != null ? (
          <Line
            label={t({ th: "สมัครช่วง", en: "Signed up" })}
            right={value(t(pageWindow(coupon.signupFrom, coupon.signupTo)))}
          />
        ) : (
          <Line
            label={t({ th: "ช่วงเวลา", en: "When" })}
            right={value(t(pageWindow(coupon.startsAt, coupon.endsAt)))}
          />
        )}
        <Line
          label={t({ th: "สร้างเมื่อ", en: "Made on" })}
          right={value(t(dayPill(coupon.createdAt)))}
        />
        <Line
          label={t({ th: "สร้างโดย", en: "Made by" })}
          right={value(creatorName(coupon))}
          last
        />
      </Group>
    </View>
  );
}

/** ลบคูปอง ส่งฟรี 11.11? — a red ลบ and a grey ยกเลิก, nothing else (as drawn). */
function DeleteSheet(props: {
  coupon: Coupon;
  token: string;
  onClose: () => void;
  onUsed: () => void;
  onFailed: (why: string) => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const name = props.coupon.name || props.coupon.code;
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await deleteCoupon(fetch, API_BASE, props.token, props.coupon.id);
      props.onClose();
      // Someone may have used it since the page opened; then it stays, and the page says why.
      if (out === "used") return props.onUsed();
      router.canGoBack() ? router.back() : router.replace(BASE as never);
    } catch (e) {
      props.onClose();
      props.onFailed(e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title={t({ th: `ลบคูปอง ${name}?`, en: `Delete ${name}?` })}
      onClose={props.onClose}
      noPill
    >
      <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={() => void remove()} />
      <BigButton label={t({ th: "ยกเลิก", en: "Cancel" })} kind="grey" onPress={props.onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // The frame's ‹ back pill is 36 tall with 8 under it; แก้ไข sits on the same line, on the right.
  editPill: {
    alignSelf: "flex-end",
    marginTop: -44,
    marginBottom: SPACE.s,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  } as never,
  name: { marginHorizontal: 2 },
  card: { marginTop: 14 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: SPACE.m },
  code: { fontSize: 28, lineHeight: 36, fontWeight: "700", letterSpacing: 0.5 },
  copy: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1, minWidth: 0 },
  facts: { marginTop: SPACE.m },
  state: { flexDirection: "row", alignItems: "center", gap: 6 },
  value: { flexShrink: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
  used: { paddingVertical: SPACE.m, paddingHorizontal: SPACE.l, gap: SPACE.s },
  usedHead: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  bar: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  deleteGroup: { marginTop: SPACE.xl + SPACE.xs },
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
  wideRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.xl, marginTop: 14 },
  wideLeft: { flex: 1, minWidth: 0 },
  wideRight: { flex: 1.15, minWidth: 0 },
});
