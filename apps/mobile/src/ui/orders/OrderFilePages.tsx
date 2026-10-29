import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { useScreenChrome, type ChromeToast } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE } from "../theme";
import { PrivateImage } from "./PrivateImage";
import { LabelPreview, SaveButtons, useLabelFile } from "./ShippingLabel";
import { useOrderDetail, type OrderLoad } from "./useOrderDetail";

/**
 * The order's files each open a page of their own from its ไฟล์ card (owner approved the drawing,
 * 2026-10-29): the shipping label, whole, with PDF / PNG to save it; and the payment slip. Like every
 * page under the order, they have a back link and so no tab bar.
 */

/** The page's name as its large title, and "‹ AP-1042" back to the order. */
export function useFilePage(
  id: string,
  title: string,
  load: OrderLoad,
  toast: ChromeToast | null = null,
) {
  const router = useRouter();
  const { t } = useLang();
  useScreenChrome(null, [], {
    title,
    back: {
      label:
        load.status === "ready"
          ? load.detail.order.externalOrderId
          : t({ th: "ออเดอร์", en: "Order" }),
      onPress: () =>
        router.canGoBack()
          ? router.back()
          : router.replace(`/orders/${encodeURIComponent(id)}` as never),
    },
    toast,
  });
}

export function LoadState({ load }: { load: OrderLoad }) {
  const { theme } = useTheme();
  const { t } = useLang();
  if (load.status === "loading") {
    return <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />;
  }
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[TYPE.body, { color: theme.text }]}>
        {load.status === "missing"
          ? t({ th: "ไม่พบออเดอร์", en: "Order not found" })
          : t({ th: "โหลดออเดอร์ไม่สำเร็จ", en: "Could not load the order" })}
      </Text>
      {load.status === "failed" && (
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{load.message}</Text>
      )}
    </View>
  );
}

export function LabelScreen({ id }: { id: string }) {
  const auth = useAuth();
  const { t } = useLang();
  const token = auth.status === "signed-in" ? auth.token : null;
  const { load } = useOrderDetail(id, token);
  const detail = load.status === "ready" ? load.detail : null;
  const file = useLabelFile(detail?.order.externalOrderId ?? "");
  useFilePage(id, t({ th: "ใบปะหน้าพัสดุ", en: "Shipping label" }), load);

  if (!detail || !token) return <LoadState load={load} />;
  return (
    <View style={styles.body}>
      <View style={styles.tools}>
        <SaveButtons file={file} />
      </View>
      <LabelPreview detail={detail} token={token} file={file} />
    </View>
  );
}

export function SlipScreen({ id }: { id: string }) {
  const auth = useAuth();
  const { theme } = useTheme();
  const { t } = useLang();
  const token = auth.status === "signed-in" ? auth.token : null;
  const { load } = useOrderDetail(id, token);
  useFilePage(id, t({ th: "สลิปการชำระเงิน", en: "Payment slip" }), load);

  if (load.status !== "ready") return <LoadState load={load} />;
  const { order, viewerIsSuperAdmin } = load.detail;
  const ownerOnly = t({ th: "เห็นรูปได้เฉพาะเจ้าของร้าน", en: "Only the owner sees the picture" });
  return (
    <View style={styles.body}>
      <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
        {order.slipImageKey ? ownerOnly : t({ th: "ยังไม่มีสลิป", en: "No slip yet" })}
      </Text>
      {/* The API refuses the picture to anyone else as well; this only saves them a dead frame. */}
      {viewerIsSuperAdmin && order.slipImageKey && (
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <PrivateImage
            fileKey={order.slipImageKey}
            label={t({ th: "สลิปการชำระเงิน", en: "Payment slip" })}
            style={styles.slip}
            fit="contain"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: SPACE.m, gap: SPACE.m },
  tools: { flexDirection: "row", justifyContent: "flex-end" },
  card: { borderRadius: RADIUS.card, padding: SPACE.l, gap: SPACE.xs },
  slip: { width: "100%", height: 520, borderRadius: RADIUS.thumb },
});
