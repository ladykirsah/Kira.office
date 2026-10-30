import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { formatBaht } from "@/lib/money";
import type { OpenDraft } from "@/lib/posApi";
import { draftRowText } from "@/lib/posBill";
import { billDate } from "@/lib/scanSale";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { DateBox } from "../orders/DateBox";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { Segmented } from "../Segmented";
import { RADIUS, SPACE, TYPE } from "../theme";
import { BillDoc } from "./BillDoc";
import { ChoiceRow, FieldRow, Note } from "./fields";
import { usePos } from "./PosSessionProvider";
import { saveDoc } from "./saveDoc";

const DELETE_WIDTH = 88;

/** ฉบับร่างและใบเสนอราคา — tap to carry on; swipe left to delete (asked first); keep this bill. */
export function DraftsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const pos = usePos();
  const [tab, setTab] = useState<"all" | "draft" | "quotation">("all");
  const all = pos.data.drafts;
  const count = (s: "draft" | "quotation") => all.filter((d) => d.stage === s).length;
  const shown = tab === "all" ? all : all.filter((d) => d.stage === tab);
  return (
    <Sheet
      title={t({ th: "ฉบับร่างและใบเสนอราคา", en: "Drafts and quotations" })}
      closeLabel={t({ th: "ปิด", en: "Close" })}
      onClose={onClose}
      tall
    >
      <Segmented
        label={t({ th: "แสดง", en: "Show" })}
        options={[
          { value: "all", label: t({ th: `ทั้งหมด (${all.length})`, en: `All (${all.length})` }) },
          {
            value: "draft",
            label: t({ th: `ฉบับร่าง (${count("draft")})`, en: `Drafts (${count("draft")})` }),
          },
          {
            value: "quotation",
            label: t({
              th: `ใบเสนอราคา (${count("quotation")})`,
              en: `Quotes (${count("quotation")})`,
            }),
          },
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />
      {shown.length > 0 && (
        <Group>
          {shown.map((d, i) => (
            <SwipeRow key={d.id} draft={d} last={i === shown.length - 1} />
          ))}
        </Group>
      )}
      <Note>
        {t({
          th: "แตะเพื่อทำบิลต่อ · บิลที่ทำค้างไว้เก็บเป็นร่างให้ก่อน · ปัดซ้ายเพื่อลบ (ถามก่อนลบ) · ฉบับร่างไม่ตัดสต็อก",
          en: "Tap to carry on · the bill on screen is kept first · swipe left to delete (asked first) · drafts take no stock",
        })}
      </Note>
      <BigButton
        label={t({ th: "เก็บบิลนี้เป็นร่าง", en: "Keep this bill as a draft" })}
        onPress={() => void pos.keepDraft().then((ok) => ok && onClose())}
      />
    </Sheet>
  );
}

function SwipeRow({ draft, last }: { draft: OpenDraft; last: boolean }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const [width, setWidth] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const text = draftRowText({ ...draft, buyerName: draft.buyerName ?? null }, Date.now());
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }
      }
    >
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToOffsets={[0, DELETE_WIDTH]}
        decelerationRate="fast"
        bounces={false}
      >
        <Pressable
          onPress={() => void pos.openDraft(draft)}
          accessibilityRole="button"
          style={[styles.draft, { width: width || undefined }]}
        >
          <View style={styles.grow}>
            <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(text.top)}</Text>
            <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={1}>
              {text.main ?? t({ th: "ยังไม่ใส่ทะเบียน", en: "No plate yet" })}
            </Text>
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{t(text.when)}</Text>
          </View>
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        </Pressable>
        <Pressable
          onPress={() => {
            scroller.current?.scrollTo({ x: 0, animated: true });
            pos.setSheet({ deleteDraft: draft.id });
          }}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ลบ", en: "Delete" })}
          style={[styles.delete, { backgroundColor: theme.danger }]}
        >
          <Text style={[TYPE.subhead, { color: "#FFFFFF", fontWeight: "600" }]}>
            {t({ th: "ลบ", en: "Delete" })}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function DeleteDraftSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useLang();
  const pos = usePos();
  const d = pos.data.drafts.find((x) => x.id === id);
  const name = d
    ? (draftRowText({ ...d, buyerName: d.buyerName ?? null }, Date.now()).main ?? "")
    : "";
  return (
    <Sheet
      title={t({ th: "ลบฉบับร่างนี้?", en: "Delete this draft?" })}
      onClose={() => pos.setSheet("drafts")}
    >
      <Note>
        {[name, t({ th: "ลบแล้วเอากลับไม่ได้", en: "This cannot be undone" })]
          .filter(Boolean)
          .join(" · ")}
      </Note>
      <BigButton
        label={t({ th: "ลบ", en: "Delete" })}
        onPress={() => void pos.removeDraft(id).then(() => pos.setSheet("drafts"))}
      />
      <BigButton label={t({ th: "ไม่ลบ", en: "Keep it" })} kind="grey" onPress={onClose} />
    </Sheet>
  );
}

/** บิลรอส่งเข้าระบบ (ทำบิล 6) — each bill still on this phone, and why one did not go in. */
export function QueueSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  // Everything went in: nothing left to show.
  useEffect(() => {
    if (pos.queue.length === 0) onClose();
  }, [pos.queue.length, onClose]);
  return (
    <Sheet
      title={t({ th: "บิลรอส่งเข้าระบบ", en: "Bills waiting to send" })}
      closeLabel={t({ th: "ปิด", en: "Close" })}
      onClose={onClose}
    >
      <Group>
        {pos.queue.map((q, i) => {
          const refused = q.status === "refused";
          const at = billDate(q.issuedAt).time;
          return (
            <View
              key={q.sale.clientUuid}
              style={[
                styles.draft,
                i < pos.queue.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <View style={styles.grow}>
                <View style={styles.top}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: refused ? theme.danger : theme.textMuted },
                    ]}
                  />
                  <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
                    {refused
                      ? t({ th: `ส่งไม่ผ่าน · ${at}`, en: `Refused · ${at}` })
                      : t({ th: `รอเน็ต · ${at}`, en: `Waiting · ${at}` })}
                  </Text>
                </View>
                <Text style={[TYPE.headline, { color: theme.text }]}>
                  {[q.sale.saleNumber, q.label].filter(Boolean).join(" · ")}
                </Text>
                <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                  {refused && q.reason
                    ? q.reason
                    : t({
                        th: `${formatBaht(q.totalSatang)} · ${q.sale.lines.length} รายการ`,
                        en: `${formatBaht(q.totalSatang)} · ${q.sale.lines.length} items`,
                      })}
                </Text>
              </View>
            </View>
          );
        })}
      </Group>
      <Note>
        {t({
          th: "บิลอยู่กับลูกค้าแล้ว ไม่ต้องทำใหม่ · ส่งไม่ผ่านเพราะสต็อกในระบบไม่ตรง → ปรับสต็อกที่ สแกน › จัดการสต็อก แล้วกดส่งอีกครั้ง",
          en: "The customer has the bill; don't redo it · a refusal means the stock count is off → fix it in Scan › Manage stock, then send again",
        })}
      </Note>
      <BigButton
        label={t({ th: "ส่งอีกครั้ง", en: "Send again" })}
        onPress={() => void pos.resend()}
      />
    </Sheet>
  );
}

/** A known customer's name and phones, from the customer row. Saved with the bill. */
export function CustomerSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const pos = usePos();
  const phones = pos.bill.phones.length > 0 ? pos.bill.phones : [""];
  return (
    <Sheet
      title={t({ th: "ลูกค้า", en: "Customer" })}
      sub={pos.bill.plate}
      closeLabel={t({ th: "เสร็จ", en: "Done" })}
      onClose={onClose}
    >
      <Group>
        <FieldRow
          label={t({ th: "ชื่อ", en: "Name" })}
          value={pos.bill.customerName}
          placeholder={t({ th: "ไม่บังคับ", en: "Optional" })}
          onChange={(v) => pos.setBill((b) => ({ ...b, customerName: v }))}
        />
        {phones.map((p, i) => (
          <FieldRow
            key={i}
            label={t({ th: "เบอร์โทร", en: "Phone" })}
            value={p}
            placeholder={t({ th: "ไม่บังคับ", en: "Optional" })}
            keyboardType="phone-pad"
            onChange={(v) =>
              pos.setBill((b) => ({ ...b, phones: phones.map((x, j) => (j === i ? v : x)) }))
            }
          />
        ))}
        <ChoiceRow
          label={t({ th: "＋ เพิ่มเบอร์", en: "＋ Add a number" })}
          action
          onPress={() => pos.setBill((b) => ({ ...b, phones: [...phones, ""] }))}
          last
        />
      </Group>
      <Note>
        {t({
          th: "บันทึกเข้าสมุดลูกค้าตอนออกบิล",
          en: "Saved to customers when the bill is issued",
        })}
      </Note>
    </Sheet>
  );
}

export function NoteSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const [text, setText] = useState(pos.bill.note);
  const done = () => {
    pos.setBill((b) => ({ ...b, note: text }));
    onClose();
  };
  return (
    <Sheet
      title={t({ th: "หมายเหตุบนบิล", en: "Note on the bill" })}
      onClose={onClose}
      onDone={done}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        placeholder={t({
          th: "ไม่บังคับ · เช่น รับประกันคอมเพรสเซอร์ 6 เดือน",
          en: "Optional · e.g. 6-month compressor warranty",
        })}
        placeholderTextColor={theme.textFaint}
        style={[TYPE.body, styles.note, { color: theme.text, backgroundColor: theme.surface }]}
      />
    </Sheet>
  );
}

export function DateSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const pos = usePos();
  const [day, setDay] = useState<number | null>(pos.print.date ?? Date.now());
  return (
    <Sheet
      title={t({ th: "วันที่ในบิล", en: "Date on the bill" })}
      onClose={onClose}
      onDone={() => {
        pos.setPrint({ ...pos.print, date: day });
        onClose();
      }}
    >
      <DateBox
        value={day}
        onChange={setDay}
        label={t({ th: "วันที่ในบิล", en: "Date on the bill" })}
      />
      <Note>
        {t({
          th: "เปลี่ยนได้แค่วันที่ที่พิมพ์บนบิล",
          en: "Changes only the date printed on the bill",
        })}
      </Note>
    </Sheet>
  );
}

/** แบบบิล or ภาษา: two choices, a ✓ on the one in use. */
export function OptionSheet({
  what,
  onClose,
}: {
  what: "style" | "language";
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const options =
    what === "style"
      ? [
          {
            on: pos.print.style === "receipt",
            label: t({ th: "ใบเสร็จ", en: "Receipt" }),
            pick: () => pos.setPrint({ ...pos.print, style: "receipt" }),
          },
          {
            on: pos.print.style === "invoice",
            label: t({ th: "ใบแจ้งหนี้", en: "Invoice" }),
            pick: () => pos.setPrint({ ...pos.print, style: "invoice" }),
          },
        ]
      : [
          {
            on: pos.print.lang === "th",
            label: "ไทย",
            pick: () => pos.setPrint({ ...pos.print, lang: "th" }),
          },
          {
            on: pos.print.lang === "en",
            label: "English",
            pick: () => pos.setPrint({ ...pos.print, lang: "en" }),
          },
        ];
  return (
    <Sheet
      title={
        what === "style" ? t({ th: "แบบบิล", en: "Bill type" }) : t({ th: "ภาษา", en: "Language" })
      }
      onClose={onClose}
    >
      <Group>
        {options.map((o, i) => (
          <Pressable
            key={o.label}
            onPress={() => {
              o.pick();
              onClose();
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: o.on }}
            style={[
              styles.option,
              i === 0 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{o.label}</Text>
            {o.on && <LineIcon d={ICON.check} color={theme.primary} size={18} strokeWidth={2.6} />}
          </Pressable>
        ))}
      </Group>
    </Sheet>
  );
}

/** ดูบิล — the file before payment. Saving it keeps the bill as a quotation (drawn note: "ส่งบิลก่อนรับเงิน = เก็บเป็นใบเสนอราคา"). */
export function PreviewSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const pos = usePos();
  const node = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const quote = pos.bill.doc === "quote" || pos.quoteNumber !== null;
  const save = async (kind: "pdf" | "png") => {
    if (busy || !node.current) return;
    setBusy(true);
    try {
      // The file must carry a number: a bill not paid yet goes into the drafts as a quotation.
      const number = pos.quoteNumber ?? (await pos.fileAsQuote());
      if (!number) return;
      await new Promise((r) => setTimeout(r, 50));
      await saveDoc(kind, node.current, `${number}.${kind}`);
    } catch (e) {
      pos.showToast(
        { th: "บันทึกไม่ได้", en: "Not saved" },
        { th: (e as Error).message, en: (e as Error).message },
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title={
        quote ? t({ th: "ใบเสนอราคา", en: "Quotation" }) : t({ th: "ดูบิล", en: "See the bill" })
      }
      closeLabel={t({ th: "ปิด", en: "Close" })}
      onClose={onClose}
      tall
    >
      <BillDoc
        ref={node}
        doc={{
          kind: quote ? "quote" : "bill",
          number: pos.quoteNumber,
          at: Date.now(),
          bill: pos.bill,
          print: pos.print,
          shopName: pos.data.shopName,
          paymentMethod: null,
          receivedBy: "",
        }}
      />
      <BigButton label={t({ th: "บันทึก PDF", en: "Save PDF" })} onPress={() => void save("pdf")} />
      <BigButton
        label={t({ th: "บันทึกรูป", en: "Save picture" })}
        kind="grey"
        onPress={() => void save("png")}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  draft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.m,
  },
  grow: { flex: 1, minWidth: 0 },
  delete: { width: DELETE_WIDTH, alignItems: "center", justifyContent: "center" },
  top: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  note: {
    minHeight: 120,
    borderRadius: RADIUS.card,
    padding: SPACE.l,
    textAlignVertical: "top",
    outlineStyle: "none",
  } as never,
  option: { minHeight: 52, paddingHorizontal: SPACE.l, flexDirection: "row", alignItems: "center" },
});
