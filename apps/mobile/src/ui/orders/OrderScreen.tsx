import {
  operationalStatus,
  operationalStatusPhrase,
  orderDocuments,
  trackingUrl,
} from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared/lang";
import { useRouter } from "expo-router";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { API_BASE } from "@/lib/config";
import { initials } from "@/lib/initials";
import { formatBaht } from "@/lib/money";
import { stamp } from "@/lib/orderList";
import {
  addressLine,
  deliveryNow,
  jobFor,
  pageSections,
  pinsTracking,
  progressStep,
  slipRow,
  type PageSection,
} from "@/lib/orderPage";
import { saveNote, type OrderDetail } from "@/lib/ordersApi";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { openPage } from "../openPage";
import { useScreenChrome, type ChromeButton, type ChromeToast } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE, type Theme } from "../theme";
import { ClaimJob } from "./ClaimJob";
import { ClaimSummary } from "./ClaimSummary";
import { ICON } from "./icons";
import { CodJob, PayJob, RefundJob, ShipJob, type JobContext } from "./Jobs";
import { isCodOrder } from "./OrderDetailPages";
import { Group, Row, SectionTitle } from "./parts";
import { PinProvider } from "./pin";
import { PrivateImage } from "./PrivateImage";
import { Sheet } from "./Sheet";
import { useOrderDetail } from "./useOrderDetail";

const TOAST_MS = 2600;
const PATH: Phrase[] = [
  { th: "สั่งซื้อ", en: "Placed" },
  { th: "ชำระเงิน", en: "Paid" },
  { th: "เตรียมจัดส่ง", en: "To ship" },
  { th: "กำลังจัดส่ง", en: "In transit" },
  { th: "จัดส่งสำเร็จ", en: "Delivered" },
];

/**
 * One AirPlus order, Shopee's way (owner approved the drawing, 2026-10-29): its number, status and
 * progress; the one job waiting on the shop at the top, its main action pinned at the bottom; then
 * short blocks with › to pages of their own. A sub-page of the Orders list, so no tab bar.
 */
export function OrderScreen({ id }: { id: string }) {
  const auth = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [toast, setToast] = useState<ChromeToast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Each job box hands its buttons up here, keyed by the box (see pin.ts).
  const [pins, setPins] = useState<Record<string, ChromeButton[]>>({});
  const setPin = useCallback(
    (owner: string, buttons: ChromeButton[] | null) =>
      setPins((prev) =>
        buttons == null
          ? Object.fromEntries(Object.entries(prev).filter(([key]) => key !== owner))
          : { ...prev, [owner]: buttons },
      ),
    [],
  );
  const token = auth.status === "signed-in" ? auth.token : null;
  const s = styles(theme);
  const { load, reload } = useOrderDetail(id, token);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (next: ChromeToast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const copyTracking = (text: string) => {
    void globalThis.navigator?.clipboard?.writeText(text);
    showToast({
      title: t({ th: "คัดลอกเลขพัสดุแล้ว", en: "Tracking number copied" }),
      detail: text,
    });
  };

  const run: JobContext["run"] = (work, done) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    work()
      .then(() => {
        showToast(done);
        reload();
      })
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  const detail = load.status === "ready" ? load.detail : null;
  const job = detail ? jobFor(detail) : null;
  const track = detail ? trackingUrl(detail.order.carrier, detail.order.trackingNo) : null;
  const trackButton: ChromeButton[] =
    detail && track && pinsTracking({ ...detail.order, trackUrl: track }, job)
      ? [
          {
            label: t({
              th: `ติดตามพัสดุที่ ${detail.order.carrier}`,
              en: `Track at ${detail.order.carrier}`,
            }),
            onPress: () => openPage(track),
          },
        ]
      : [];
  useScreenChrome(null, [...Object.values(pins).flat(), ...trackButton], {
    title: detail?.order.externalOrderId ?? "",
    back: {
      label: t({ th: "ออเดอร์", en: "Orders" }),
      onPress: () => (router.canGoBack() ? router.back() : router.replace("/orders" as never)),
    },
    toast,
  });

  if (load.status === "loading") {
    return <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />;
  }
  if (load.status !== "ready" || !token) {
    return (
      <View style={[s.card, s.padded]}>
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

  const d = load.detail;
  const ctx: JobContext = {
    detail: d,
    token,
    run,
    busy,
  };

  return (
    <PinProvider value={setPin}>
      <Header detail={d} />
      {problem && (
        <View style={[s.card, s.padded, { marginTop: SPACE.l }]} accessibilityRole="alert">
          <Text style={[TYPE.subhead, { color: theme.danger }]}>{problem}</Text>
        </View>
      )}
      {job === "pay" && <PayJob ctx={ctx} />}
      {job === "cod" && <CodJob ctx={ctx} />}
      {job === "ship" && <ShipJob ctx={ctx} />}
      {job === "refund" && <RefundJob ctx={ctx} />}
      {job === "claim" && <ClaimJob ctx={ctx} />}
      <ClaimSummary detail={d} onCopy={copyTracking} />
      <Sections
        detail={d}
        token={token}
        onSaved={(toast) => {
          showToast(toast);
          reload();
        }}
        onOpen={(page) => router.push(`/orders/${encodeURIComponent(d.order.id)}/${page}` as never)}
      />
    </PinProvider>
  );
}

const DOT_TONE: Partial<Record<string, keyof Theme>> = {
  verifying: "waiting",
  cod_pending: "waiting",
  to_ship: "toShip",
  return: "danger",
};

/** Ordered when, the status as a dot and a word, and how far along the main path it is. */
function Header({ detail }: { detail: OrderDetail }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { order } = detail;
  const op = operationalStatus(order.orderStatus, order.paymentStatus);
  const now = progressStep(order.orderStatus, order.paymentStatus);
  const tone = op ? DOT_TONE[op] : undefined;
  const statusText: Phrase = op
    ? operationalStatusPhrase(op)
    : { th: order.orderStatus ?? "—", en: order.orderStatus ?? "—" };
  return (
    <View style={{ marginTop: -SPACE.s, paddingHorizontal: 2 }}>
      <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
        {t({ th: "สั่งซื้อเมื่อ", en: "Ordered" })}{" "}
        {stamp(order.orderCreatedAt ?? order.importedAt)}
      </Text>
      <View style={headerStyles.status}>
        <View
          style={[
            headerStyles.dot,
            { backgroundColor: tone ? (theme[tone] as string) : theme.textMuted },
          ]}
        />
        <Text style={[TYPE.subhead, { color: theme.text }]}>{t(statusText)}</Text>
      </View>
      {now != null && (
        <View
          style={headerStyles.strip}
          accessibilityLabel={`${t({ th: "ความคืบหน้า", en: "Progress" })}: ${t(PATH[now]!)}`}
        >
          {PATH.map((step, i) => (
            <View key={step.en} style={headerStyles.stepCol}>
              <View
                style={[
                  headerStyles.bar,
                  {
                    backgroundColor:
                      i < now ? theme.text : i === now ? theme.primary : theme.border,
                  },
                ]}
              />
              <Text
                style={[
                  TYPE.caption,
                  { color: i === now ? theme.text : theme.textMuted, fontWeight: "400" },
                ]}
                numberOfLines={1}
              >
                {t(step)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  status: { marginTop: SPACE.xs, flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  strip: { marginTop: SPACE.m, flexDirection: "row", gap: SPACE.xs },
  stepCol: { flex: 1, gap: 5 },
  bar: { height: 4, borderRadius: 2 },
});

type SubPage = "label" | "slip" | "payment" | "shipping" | "customer";

const STEP_WORDS = {
  notSent: { th: "ยังไม่ได้ส่ง", en: "Not sent yet" },
  inTransit: { th: "กำลังจัดส่ง", en: "In transit" },
  delivered: { th: "จัดส่งสำเร็จ", en: "Delivered" },
  bounced: { th: "พัสดุตีกลับถึงร้าน", en: "Bounced back to the shop" },
} as const;

/**
 * Everything below the job, in Shopee's order (pageSections): each block short, with › to a page
 * of its own for the rest — the parcel and its timeline, the money, the customer.
 */
function Sections(props: {
  detail: OrderDetail;
  token: string;
  onSaved: (toast: ChromeToast) => void;
  onOpen: (page: SubPage) => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const d = props.detail;
  const { order, money, address, customer } = d;
  const dash = "—";
  const docs = orderDocuments({
    paymentStatus: order.paymentStatus,
    hasSlipImage: !!order.slipImageKey,
    claimPhotoCount: d.claims.reduce((n, c) => n + c.photoKeys.length, 0),
  });
  const [viewingEvidence, setViewingEvidence] = useState(false);
  const [noting, setNoting] = useState(false);
  const slip = slipRow(
    docs.find((doc) => doc.kind === "payment_slip"),
    d.viewerIsSuperAdmin,
  );
  const evidence = docs.find((doc) => doc.kind === "claim_evidence");
  const now = deliveryNow(order, d.timeline);
  const stepDot: Record<keyof typeof STEP_WORDS, string> = {
    notSent: theme.textFaint,
    inTransit: theme.success,
    delivered: theme.success,
    bounced: theme.danger,
  };
  const phone = customer?.phone ?? address?.phone ?? null;
  const render: Record<PageSection, () => ReactNode> = {
    address: () => (
      <Info icon={ICON.pin} title={t({ th: "ที่อยู่ในการจัดส่ง", en: "Delivery address" })}>
        {address ? (
          <>
            <Text style={[TYPE.body, { color: theme.text }]}>
              {[address.recipientName, address.phone].filter(Boolean).join(" • ") || dash}
            </Text>
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{addressLine(address)}</Text>
          </>
        ) : (
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
            {t({ th: "ไม่มีที่อยู่ในออเดอร์นี้", en: "No address on this order" })}
          </Text>
        )}
      </Info>
    ),
    delivery: () => (
      <Info
        icon={ICON.truck}
        title={t({ th: "ข้อมูลการจัดส่ง", en: "Shipping" })}
        more={t({ th: "ดูเพิ่มเติม", en: "More" })}
        onPress={() => props.onOpen("shipping")}
        spaced
      >
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {now.parcel ?? t({ th: "ยังไม่มีเลขพัสดุ", en: "No tracking number yet" })}
        </Text>
        <View style={infoStyles.now}>
          <View style={[infoStyles.nowDot, { backgroundColor: stepDot[now.step] }]} />
          <Text style={[TYPE.subhead, { color: theme.text }]}>{t(STEP_WORDS[now.step])}</Text>
          {now.at != null && (
            <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{stamp(now.at)}</Text>
          )}
        </View>
      </Info>
    ),
    items: () => (
      <>
        <SectionTitle text={t({ th: "รายการสินค้า", en: "Items" })} />
        <Group>
          {d.lines.map((l, i) => (
            <View key={l.id} style={lineStyles.line}>
              {l.imageKey ? (
                <Image
                  source={{ uri: `${API_BASE}/img/${l.imageKey}` }}
                  style={[lineStyles.photo, { backgroundColor: theme.bg }]}
                />
              ) : (
                <View style={[lineStyles.photo, { backgroundColor: theme.hover }]} />
              )}
              {/* The line between products starts at the text, as in Apple's lists. */}
              <View
                style={[
                  lineStyles.lineText,
                  i < d.lines.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <Text style={[TYPE.headline, { color: theme.text }]}>{l.name ?? dash}</Text>
                <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                  {[
                    `× ${l.quantity}`,
                    l.variantName,
                    l.productRef
                      ? t({ th: `รหัสสินค้า ${l.productRef}`, en: `ID ${l.productRef}` })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </View>
          ))}
          {d.lines.length === 0 && (
            <Row label={t({ th: "ไม่มีรายการสินค้า", en: "No item lines" })} last />
          )}
        </Group>
      </>
    ),
    payment: () => (
      <>
        <SectionTitle text={t({ th: "การชำระเงิน", en: "Payment" })} />
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
          {/* The fee behind the shipping and the profit sit on their own page (Shopee). */}
          <Row
            label={t({ th: "ยอดรวมทั้งสิ้น", en: "Total" })}
            sub={t({
              th: "ดูรายละเอียด ค่าจัดส่ง และกำไร",
              en: "Details, shipping fee and profit",
            })}
            value={formatBaht(money.customerPaidSatang)}
            bold
            last
            opens
            onPress={() => props.onOpen("payment")}
          />
        </Group>
      </>
    ),
    files: () => (
      <>
        <SectionTitle text={t({ th: "ไฟล์", en: "Files" })} />
        <Group>
          {/* Each file opens its own page (owner, 29 Oct); the label's PDF / PNG are there. */}
          <DocRow
            label={t({ th: "ใบปะหน้าพัสดุ", en: "Shipping label" })}
            last={!slip && !evidence}
            onPress={() => props.onOpen("label")}
          />
          {slip && (
            <DocRow
              label={t({ th: "สลิปการชำระเงิน", en: "Payment slip" })}
              sub={
                slip.note === "none"
                  ? t({ th: "ยังไม่มีสลิป", en: "No slip yet" })
                  : t({ th: "เห็นรูปได้เฉพาะเจ้าของร้าน", en: "Only the owner sees the picture" })
              }
              last={!evidence}
              onPress={slip.opens ? () => props.onOpen("slip") : undefined}
            />
          )}
          {evidence && (
            <DocRow
              label={`${t({ th: "หลักฐานการเคลม", en: "Claim evidence" })} (${evidence.count})`}
              last
              onPress={() => setViewingEvidence(true)}
            />
          )}
        </Group>
      </>
    ),
    customer: () => (
      <>
        <SectionTitle text={t({ th: "ลูกค้า", en: "Customer" })} />
        <Group>
          {customer ? (
            <Pressable
              onPress={() => props.onOpen("customer")}
              accessibilityRole="button"
              accessibilityLabel={customer.name ?? t({ th: "ลูกค้า", en: "Customer" })}
              style={infoStyles.person}
            >
              <View style={[infoStyles.avatar, { backgroundColor: theme.hover }]}>
                <Text style={[TYPE.subhead, { color: theme.text, fontWeight: "700" }]}>
                  {initials(customer.name ?? "")}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[TYPE.body, { color: theme.text }]}>{customer.name ?? dash}</Text>
                <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                  {[
                    customer.customerCode,
                    customer.tier,
                    t({
                      th: `สำเร็จ ${customer.completeCount} · ไม่สำเร็จ ${customer.incompleteCount}`,
                      en: `${customer.completeCount} done · ${customer.incompleteCount} not`,
                    }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
            </Pressable>
          ) : (
            <Row
              label={t({
                th: `ไม่มีบัญชีหน้าร้าน — ${order.buyerUsername ?? dash}`,
                en: `No storefront account — ${order.buyerUsername ?? dash}`,
              })}
              last
            />
          )}
        </Group>
      </>
    ),
    actions: () => (
      <View style={infoStyles.actions}>
        {order.staffNote ? (
          <View style={[infoStyles.noteCard, { backgroundColor: theme.surface }]}>
            <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
              {t({ th: "บันทึกภายใน", en: "Internal note" })}
            </Text>
            <Text style={[TYPE.body, { color: theme.text }]}>{order.staffNote}</Text>
          </View>
        ) : null}
        <QuietButton
          icon={ICON.note}
          label={
            order.staffNote
              ? t({ th: "แก้บันทึก", en: "Edit note" })
              : t({ th: "เพิ่มบันทึก", en: "Add a note" })
          }
          onPress={() => setNoting(true)}
        />
        {phone && (
          <QuietButton
            icon={ICON.phone}
            label={t({ th: "โทรหาลูกค้า", en: "Call the customer" })}
            onPress={() => void Linking.openURL(`tel:${phone}`)}
          />
        )}
      </View>
    ),
  };

  return (
    <>
      {pageSections().map((key) => (
        <Fragment key={key}>{render[key]()}</Fragment>
      ))}

      {noting && (
        <NoteSheet
          detail={d}
          token={props.token}
          onClose={() => setNoting(false)}
          onSaved={(toast) => {
            setNoting(false);
            props.onSaved(toast);
          }}
        />
      )}

      {viewingEvidence && (
        <Sheet
          title={t({ th: "หลักฐานการเคลม", en: "Claim evidence" })}
          sub={order.externalOrderId}
          closeLabel={t({ th: "ปิด", en: "Close" })}
          onClose={() => setViewingEvidence(false)}
          tall
        >
          {d.claims
            .flatMap((c) => c.photoKeys)
            .map((key) => (
              <PrivateImage
                key={key}
                fileKey={key}
                label={key}
                style={{ width: "100%", height: 420, borderRadius: RADIUS.card }}
              />
            ))}
        </Sheet>
      )}
    </>
  );
}

/** Shopee's block: an icon and a title, the short version under it, and › for the rest. */
function Info(props: {
  icon: string;
  title: string;
  more?: string;
  onPress?: () => void;
  /** It follows another block: 8 between them, not 28. */
  spaced?: boolean;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const body = (
    <View
      style={[
        infoStyles.block,
        props.spaced ? infoStyles.next : infoStyles.first,
        { backgroundColor: theme.surface },
      ]}
    >
      <View style={infoStyles.icon}>
        <LineIcon d={props.icon} color={theme.text} size={20} strokeWidth={2} />
      </View>
      <View style={infoStyles.text}>
        <View style={infoStyles.head}>
          <Text style={[TYPE.headline, { color: theme.text, flex: 1 }]}>{props.title}</Text>
          {props.more && (
            <View style={infoStyles.more}>
              <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{props.more}</Text>
              <LineIcon d={ICON.chevron} color={theme.textFaint} size={14} strokeWidth={2.4} />
            </View>
          )}
        </View>
        {props.children}
      </View>
    </View>
  );
  return props.onPress ? (
    <Pressable onPress={props.onPress} accessibilityRole="button" accessibilityLabel={props.title}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** A grey full-width button with an icon: the page's quiet actions, under everything else. */
function QuietButton(props: { icon: string; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        infoStyles.quiet,
        { backgroundColor: pressed ? theme.border : theme.hover },
      ]}
    >
      <LineIcon d={props.icon} color={theme.text} size={19} strokeWidth={2} />
      <Text style={[TYPE.body, { color: theme.text }]}>{props.label}</Text>
    </Pressable>
  );
}

const infoStyles = StyleSheet.create({
  block: {
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    gap: SPACE.m,
  },
  first: { marginTop: SPACE.xxl },
  next: { marginTop: SPACE.s },
  icon: { marginTop: 2 },
  text: { flex: 1, minWidth: 0, gap: SPACE.xs },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  more: { flexDirection: "row", alignItems: "center", gap: 2 },
  now: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: 2 },
  nowDot: { width: 8, height: 8, borderRadius: 4 },
  /** The guide's row with a second line is 68; the badge is 40 round. */
  person: {
    minHeight: 68,
    paddingVertical: SPACE.s,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { marginTop: SPACE.xxl, gap: SPACE.s },
  noteCard: {
    borderRadius: RADIUS.card,
    paddingVertical: SPACE.m,
    paddingHorizontal: SPACE.l,
    gap: 2,
  },
  /** The guide's large button height. */
  quiet: {
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.s,
  },
});

/** A file's row: its name, a grey line under it, and a › when it opens a page of its own. */
function DocRow(props: {
  label: string;
  sub?: string;
  last: boolean;
  children?: React.ReactNode;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const row = (
    <View
      style={[
        lineStyles.doc,
        props.sub ? lineStyles.docTwoLine : null,
        !props.last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.body, { color: theme.text }]}>{props.label}</Text>
        {props.sub ? (
          <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{props.sub}</Text>
        ) : null}
      </View>
      {props.children}
      {props.onPress && (
        <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
      )}
    </View>
  );
  return props.onPress ? (
    <Pressable onPress={props.onPress} accessibilityRole="button" accessibilityLabel={props.label}>
      {row}
    </Pressable>
  ) : (
    row
  );
}

/** The staff note in its own sheet: anyone signed in may write it; customers never see it. */
function NoteSheet(props: {
  detail: OrderDetail;
  token: string;
  onClose: () => void;
  onSaved: (toast: ChromeToast) => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const [text, setText] = useState(props.detail.order.staffNote ?? "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const label = t({ th: "บันทึกภายใน", en: "Internal note" });
  const save = () => {
    if (saving) return;
    setSaving(true);
    setFailed(null);
    saveNote(fetch, API_BASE, props.token, props.detail.order.id, text.trim())
      .then(() =>
        props.onSaved({
          title: t({ th: "บันทึกโน้ตแล้ว", en: "Note saved" }),
          detail: props.detail.order.externalOrderId,
        }),
      )
      .catch((e: unknown) => setFailed(e instanceof Error ? e.message : String(e)))
      .finally(() => setSaving(false));
  };
  return (
    <Sheet
      title={t({ th: "บันทึก", en: "Note" })}
      sub={props.detail.order.externalOrderId}
      onClose={props.onClose}
    >
      <Text style={[TYPE.subhead, { color: theme.text, fontWeight: "600", marginHorizontal: 4 }]}>
        {label}
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={4}
        placeholder={t({ th: "บันทึกภายใน…", en: "Internal note…" })}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={label}
        style={[lineStyles.note, { backgroundColor: theme.surface, color: theme.text }]}
      />
      {failed && <Text style={[TYPE.subhead, { color: theme.danger }]}>{failed}</Text>}
      <Text style={[TYPE.subhead, { color: theme.textMuted, marginHorizontal: 4 }]}>
        {t({ th: "ลูกค้าไม่เห็นบันทึกนี้", en: "Customers never see this note" })}
      </Text>
      <BigButton
        label={saving ? t({ th: "กำลังบันทึก…", en: "Saving…" }) : t({ th: "บันทึก", en: "Save" })}
        onPress={save}
      />
    </Sheet>
  );
}

const lineStyles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: SPACE.l },
  lineText: {
    flex: 1,
    minWidth: 0,
    minHeight: 80,
    justifyContent: "center",
    paddingVertical: SPACE.m,
    paddingRight: SPACE.l,
  },
  photo: { width: 56, height: 56, borderRadius: RADIUS.thumb },
  /** The guide's row heights: 52 for one line, 68 with a grey second line. */
  docTwoLine: { minHeight: 68 },
  doc: {
    minHeight: 52,
    marginLeft: SPACE.l,
    paddingRight: SPACE.l,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  note: {
    minHeight: 80,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...TYPE.body,
    textAlignVertical: "top",
  },
});

const styles = (c: Theme) =>
  StyleSheet.create({
    card: { borderRadius: RADIUS.card, backgroundColor: c.surface },
    padded: { padding: SPACE.l, gap: SPACE.xs },
  });
