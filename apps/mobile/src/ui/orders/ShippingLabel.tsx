import { useEffect, useRef, useState, type ComponentRef, type Ref } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { formatBaht } from "@/lib/money";
import { fetchLabelShop, type OrderDetail } from "@/lib/ordersApi";
import { linkQrPicture } from "@/lib/qr";
import {
  shippingLabel,
  shippingLabelFileName,
  type LabelShop,
  type ShippingLabel,
} from "@/lib/shippingLabel";
import { useLang, useTheme } from "../AppProviders";
import { SPACE, TYPE } from "../theme";
import { SmallButton } from "./parts";
import { saveLabel } from "./saveLabel";

type LabelNode = ComponentRef<typeof View>;
type FileKind = "pdf" | "png";

/** The label on screen and its PDF / PNG buttons share this: what to capture and how it is going. */
export interface LabelFile {
  node: React.RefObject<LabelNode | null>;
  busy: FileKind | null;
  problem: string | null;
  save: (kind: FileKind) => void;
}

/** PDF / PNG save the label as a file (owner, 29 Oct); the file is named after the order number. */
export function useLabelFile(orderRef: string): LabelFile {
  const node = useRef<LabelNode>(null);
  const [busy, setBusy] = useState<FileKind | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = (kind: FileKind) => {
    if (busy || !node.current) return;
    setBusy(kind);
    setProblem(null);
    saveLabel(kind, node.current, shippingLabelFileName(kind, orderRef))
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  };
  return { node, busy, problem, save };
}

export function SaveButtons({ file }: { file: LabelFile }) {
  const { t } = useLang();
  const saving = t({ th: "กำลังบันทึก…", en: "Saving…" });
  return (
    <View style={styles.tools}>
      <SmallButton label={file.busy === "pdf" ? saving : "PDF"} onPress={() => file.save("pdf")} />
      <SmallButton label={file.busy === "png" ? saving : "PNG"} onPress={() => file.save("png")} />
    </View>
  );
}

type ShopLoad =
  | { status: "loading" }
  | { status: "ready"; shop: LabelShop }
  | { status: "failed"; message: string };

function useLabelShop(token: string): ShopLoad {
  const [load, setLoad] = useState<ShopLoad>({ status: "loading" });
  useEffect(() => {
    let live = true;
    fetchLabelShop(fetch, API_BASE, token)
      .then((shop) => live && setLoad({ status: "ready", shop }))
      .catch(
        (e: unknown) =>
          live &&
          setLoad({ status: "failed", message: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      live = false;
    };
  }, [token]);
  return load;
}

/** The order's label, shown in full: the shop's details load first, then it draws. */
export function LabelPreview(props: {
  detail: Pick<OrderDetail, "order" | "address" | "lines">;
  token: string;
  file: LabelFile;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const shop = useLabelShop(props.token);
  if (shop.status === "loading") {
    return <ActivityIndicator color={theme.textMuted} style={styles.wait} />;
  }
  if (shop.status === "failed") {
    return (
      <Text style={[TYPE.subhead, { color: theme.danger }]} accessibilityRole="alert">
        {t({
          th: "โหลดข้อมูลร้านสำหรับใบปะหน้าไม่สำเร็จ",
          en: "Could not load the shop's details",
        })}
        {" · "}
        {shop.message}
      </Text>
    );
  }
  return (
    <>
      <ShippingLabelView label={shippingLabel(props.detail, shop.shop)} ref={props.file.node} />
      {props.file.problem && (
        <Text style={[TYPE.subhead, { color: theme.danger }]} accessibilityRole="alert">
          {t({ th: "บันทึกไฟล์ไม่สำเร็จ", en: "Could not save the file" })} · {props.file.problem}
        </Text>
      )}
    </>
  );
}

// Fixed colours, not the theme's: this is paper, saved and printed in black on white, so it must
// not follow the phone into dark mode.
const PAPER = "#FFFFFF";
const INK = "#141414";
const SOFT = "#8A8A8E";
const RULE = "#E5E5EA";
const BRAND = "#D7191F";

/** One parcel label as it prints: sender, receiver, what is in the box, cash to collect, LINE QR. */
function ShippingLabelView({ label, ref }: { label: ShippingLabel; ref: Ref<LabelNode> }) {
  return (
    <View
      ref={ref}
      collapsable={false}
      accessibilityLabel={`ใบปะหน้าพัสดุ ${label.orderRef}`}
      style={paper.sheet}
    >
      <View style={paper.head}>
        <Text style={paper.brand}>AIR+PLUS</Text>
        <Text style={paper.ref}>{label.orderRef}</Text>
      </View>

      <View style={paper.block}>
        <Text style={paper.key}>ผู้ส่ง</Text>
        <Text style={paper.from}>{label.from.title}</Text>
        <Text style={paper.fromAddress}>{label.from.address}</Text>
      </View>

      <View style={paper.block}>
        <Text style={paper.key}>ผู้รับ</Text>
        <Text style={paper.to}>{label.to.title}</Text>
        <Text style={paper.toAddress}>{label.to.address}</Text>
      </View>

      <View style={paper.block}>
        <Text style={paper.key}>ในกล่อง</Text>
        {label.items.map((item) => (
          <View key={item.id} style={paper.item}>
            <Text style={[paper.small, paper.itemName]}>{item.name}</Text>
            <Text style={[paper.small, paper.itemBrand]}>{item.brand}</Text>
            <Text style={[paper.small, paper.itemCount]}>×{item.quantity}</Text>
          </View>
        ))}
      </View>

      {label.codSatang != null && (
        <View style={[paper.block, paper.row]}>
          <Text style={paper.cod}>เก็บเงินปลายทาง {formatBaht(label.codSatang)}</Text>
        </View>
      )}

      <View style={[paper.block, paper.row]}>
        <View>
          <Image
            source={{ uri: linkQrPicture(label.qr.url) }}
            style={paper.qr}
            accessibilityLabel={label.qr.isLine ? "LINE QR" : "QR"}
          />
          {label.qr.isLine && (
            <View style={paper.badgeWrap} pointerEvents="none">
              <Text style={paper.badge}>LINE</Text>
            </View>
          )}
        </View>
        <View style={paper.thanks}>
          <Text style={paper.thanksHead}>{label.thanks.headline}</Text>
          <Text style={paper.thanksSub}>{label.thanks.subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tools: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  wait: { paddingVertical: SPACE.xl },
});

const paper = StyleSheet.create({
  sheet: {
    backgroundColor: PAPER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RULE,
    padding: 14,
    gap: 10,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontSize: 20, lineHeight: 24, fontWeight: "800", letterSpacing: -0.5, color: BRAND },
  ref: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    color: INK,
    fontVariant: ["tabular-nums"],
  },
  block: { borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  key: { fontSize: 11, lineHeight: 14, color: SOFT },
  from: { fontSize: 12, lineHeight: 17, color: INK },
  fromAddress: { fontSize: 11, lineHeight: 15, color: SOFT },
  to: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: INK },
  toAddress: { fontSize: 14, lineHeight: 20, color: INK },
  item: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  small: { fontSize: 12, lineHeight: 17, color: INK },
  itemName: { flex: 1 },
  itemBrand: { width: 80 },
  itemCount: { width: 30, textAlign: "right", fontWeight: "700" },
  cod: { fontSize: 15, lineHeight: 20, fontWeight: "800", color: INK },
  qr: { width: 64, height: 64 },
  badgeWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    backgroundColor: PAPER,
    color: INK,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "800",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  thanks: { flex: 1, gap: 2 },
  thanksHead: { fontSize: 12, lineHeight: 17, fontWeight: "700", color: INK },
  thanksSub: { fontSize: 11, lineHeight: 15, color: SOFT },
});
