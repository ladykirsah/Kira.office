import { CARRIERS, DEFAULT_CARRIER } from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { addressLine, readDropOff } from "@/lib/orderPage";
import type { OrderAddress } from "@/lib/ordersApi";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { CameraBox } from "../scan/CameraBox";
import { RADIUS, SPACE, TYPE } from "../theme";
import { ICON } from "./icons";
import { Group, Row, Say } from "./parts";
import { Sheet } from "./Sheet";

/** The pieces every job box shares: the grey detail rows, the error line and both sheets. */

/** "Saving…" on a button while its save runs. */
export const SAVING: Phrase = { th: "กำลังบันทึก…", en: "Saving…" };

/** A label/value row inside a job box's grey inset. */
export function InsetRow(props: {
  label: string;
  value: string;
  last?: boolean;
  stacked?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.insetRow,
        props.stacked && styles.stacked,
        !props.last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Text style={[TYPE.subhead, { color: theme.text }, !props.stacked && { flex: 1 }]}>
        {props.label}
      </Text>
      <Text
        style={[
          TYPE.subhead,
          { color: theme.textMuted, flexShrink: 1, textAlign: props.stacked ? "left" : "right" },
        ]}
      >
        {props.value}
      </Text>
    </View>
  );
}

export function ErrorLine({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.errorRow} accessibilityRole="alert">
      <LineIcon d={ICON.alert} color={theme.danger} size={16} strokeWidth={2.4} />
      <Text style={[TYPE.subhead, { color: theme.danger, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** A required reason, then a red confirm. An empty reason is named after the tap, not greyed out. */
export function ReasonSheet(props: {
  title: string;
  label: string;
  placeholder: string;
  note: string;
  confirm: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const [reason, setReason] = useState("");
  const [empty, setEmpty] = useState(false);
  return (
    <Sheet title={props.title} onClose={props.onClose}>
      <Text style={[TYPE.subhead, { color: theme.text, fontWeight: "600", marginHorizontal: 4 }]}>
        {props.label}
      </Text>
      <TextInput
        value={reason}
        onChangeText={(v) => {
          setReason(v);
          setEmpty(false);
        }}
        multiline
        numberOfLines={4}
        placeholder={props.placeholder}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={props.label}
        style={[styles.area, { backgroundColor: theme.surface, color: theme.text }]}
      />
      {empty && <ErrorLine text={t({ th: "ใส่เหตุผลก่อน", en: "Add a reason first" })} />}
      <Say quiet text={props.note} />
      <BigButton
        label={props.busy ? t(SAVING) : props.confirm}
        onPress={() => {
          if (!reason.trim()) {
            setEmpty(true);
            return;
          }
          props.onConfirm(reason.trim());
        }}
      />
    </Sheet>
  );
}

/**
 * The drop-off form in its own sheet (Shopify's pattern): where it goes, then carrier, tracking
 * number — typed or scanned from the carrier's receipt — and what the carrier charged. A missing
 * field is named beside it after บันทึก; nothing greys out.
 */
export function DropOffSheet(props: {
  title: string;
  orderNo: string;
  address: OrderAddress | null;
  feeLabel: string;
  after: string | null;
  busy: boolean;
  onClose: () => void;
  onSave: (value: { carrier: string; trackingNo: string; shippingRealSatang: number }) => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const [carrier, setCarrier] = useState<string>(DEFAULT_CARRIER);
  const [choosing, setChoosing] = useState(false);
  const [tracking, setTracking] = useState("");
  const [fee, setFee] = useState("");
  const [scanning, setScanning] = useState(false);
  const [missing, setMissing] = useState<"tracking" | "fee" | null>(null);
  const bad = (field: "tracking" | "fee") =>
    missing === field && { borderColor: theme.danger, borderWidth: 1.5 };
  return (
    <Sheet title={props.title} sub={props.orderNo} onClose={props.onClose} tall>
      {props.address && (
        <>
          <Text style={[styles.formHead, { color: theme.text }]}>
            {t({ th: "ส่งไปที่", en: "Send to" })}
          </Text>
          <Group>
            <Row
              label={
                [props.address.recipientName, props.address.phone].filter(Boolean).join(" · ") ||
                "—"
              }
              sub={addressLine(props.address)}
              last
            />
          </Group>
        </>
      )}
      <Text style={[styles.formHead, { color: theme.text }]}>
        {t({ th: "ข้อมูลพัสดุ", en: "Parcel" })}
      </Text>
      <View style={[styles.form, { backgroundColor: theme.surface }]}>
        <Pressable
          onPress={() => setChoosing(!choosing)}
          accessibilityRole="button"
          accessibilityLabel={`${t({ th: "ขนส่ง", en: "Carrier" })} ${carrier}`}
          style={[styles.field, { borderBottomColor: theme.border }]}
        >
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            {t({ th: "ขนส่ง", en: "Carrier" })}
          </Text>
          <Text style={[styles.value, { color: theme.textMuted }]}>{carrier}</Text>
          <LineIcon
            d="M7 9l5-5 5 5M7 15l5 5 5-5"
            color={theme.textMuted}
            size={14}
            strokeWidth={2.4}
          />
        </Pressable>
        {choosing &&
          CARRIERS.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setCarrier(c);
                setChoosing(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: c === carrier }}
              style={[styles.field, styles.option, { borderBottomColor: theme.border }]}
            >
              <Text style={[TYPE.body, { color: theme.text, flex: 1 }]}>{c}</Text>
              {c === carrier && (
                <LineIcon d={ICON.check} color={theme.primary} size={18} strokeWidth={2.6} />
              )}
            </Pressable>
          ))}
        <View style={[styles.field, { borderBottomColor: theme.border }, bad("tracking")]}>
          <Text
            style={[
              styles.fieldLabel,
              { color: missing === "tracking" ? theme.danger : theme.text },
            ]}
          >
            {t({ th: "เลขพัสดุ", en: "Tracking no." })}
          </Text>
          <TextInput
            value={tracking}
            onChangeText={(v) => {
              setTracking(v);
              setMissing(null);
            }}
            placeholder="TH…"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={t({ th: "เลขพัสดุ", en: "Tracking number" })}
            style={[styles.input, styles.right, { color: theme.text }]}
          />
          <Pressable
            onPress={() => setScanning(!scanning)}
            accessibilityRole="button"
            accessibilityLabel={t({
              th: "สแกนเลขพัสดุจากใบเสร็จขนส่ง",
              en: "Scan the tracking number",
            })}
            hitSlop={5}
            style={[styles.scanButton, { backgroundColor: theme.hover }]}
          >
            <LineIcon d={ICON.scan} color={theme.text} size={18} strokeWidth={2} />
          </Pressable>
        </View>
        {scanning && (
          <View style={{ padding: SPACE.m }}>
            <CameraBox
              height={160}
              showHint={false}
              onCode={(code) => {
                setTracking(code.trim());
                setScanning(false);
                setMissing(null);
              }}
            />
          </View>
        )}
        <View style={[styles.field, styles.lastField, bad("fee")]}>
          <Text
            style={[styles.fieldLabel, { color: missing === "fee" ? theme.danger : theme.text }]}
          >
            {props.feeLabel}
          </Text>
          <TextInput
            value={fee}
            onChangeText={(v) => {
              setFee(v);
              setMissing(null);
            }}
            placeholder="0.00"
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            accessibilityLabel={props.feeLabel}
            style={[styles.input, styles.right, { color: theme.text }]}
          />
          {/* The unit after the number, as Apple Health writes "kg". */}
          <Text style={[TYPE.body, { color: theme.textMuted }]}>{t({ th: "บาท", en: "THB" })}</Text>
        </View>
      </View>
      {missing === "tracking" && (
        <ErrorLine
          text={t({
            th: "ใส่เลขพัสดุก่อนบันทึก · กดปุ่มสแกนเพื่ออ่านจากใบเสร็จขนส่งได้",
            en: "Add the tracking number · or scan it from the receipt",
          })}
        />
      )}
      {missing === "fee" && (
        <ErrorLine
          text={t({
            th: "ใส่ค่าส่งเป็นตัวเลข เช่น 60 หรือ 60.50",
            en: "Enter the cost as a number, e.g. 60 or 60.50",
          })}
        />
      )}
      {props.after && <Say small quiet text={props.after} />}
      <BigButton
        label={props.busy ? t(SAVING) : props.title}
        onPress={() => {
          if (props.busy) return;
          const read = readDropOff(carrier, tracking, fee);
          if (!read.ok) {
            setMissing(read.missing);
            return;
          }
          props.onSave(read.value);
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  inset: { borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(118,118,128,0.08)" },
  insetRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stacked: { flexDirection: "column", alignItems: "stretch", gap: 2 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 4 },
  area: {
    minHeight: 100,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...TYPE.body,
    textAlignVertical: "top",
  },
  formHead: { ...TYPE.subhead, fontWeight: "600", marginHorizontal: 4, marginTop: SPACE.s },
  form: { borderRadius: RADIUS.card, overflow: "hidden" },
  field: {
    minHeight: 48,
    marginLeft: SPACE.l,
    paddingRight: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  lastField: { borderBottomWidth: 0 },
  option: { paddingLeft: SPACE.l },
  fieldLabel: { ...TYPE.body, flexShrink: 0 },
  value: { ...TYPE.body, flex: 1, textAlign: "right" },
  input: { ...TYPE.body, flex: 1, minWidth: 0 },
  right: { textAlign: "right" },
  scanButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});

/** The grey box that holds InsetRows. */
export const insetBox = styles.inset;
