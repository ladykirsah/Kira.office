import type { Phrase } from "@l-shopee/shared/lang";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import {
  deleteExpense,
  expenseSlipPath,
  fetchExpenses,
  putExpenseSlip,
  saveExpense,
} from "@/lib/financeApi";
import {
  SHOP_NAME,
  expenseBody,
  expenseProblems,
  money,
  type Expense,
  type ExpenseDraft,
  type Shop,
} from "@/lib/financePage";
import { bahtText } from "@/lib/flashPage";
import { dayPill, startOfDay } from "@/lib/orderList";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { DateBox } from "../orders/DateBox";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { Heading, InputRow, Line } from "../products/parts";
import { FormPage } from "../products/FormPage";
import { photoPreview, pickPhoto } from "../products/pickPhoto";
import { PhotoChoice } from "../shop/parts";
import { IconButton, PillButton, STAFF_ICON, SlipCard } from "../staff/parts";
import { useScreenChrome } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { useToast } from "../staff/useTeam";
import { SPACE, TYPE } from "../theme";
import { BASE, Loading } from "./parts";

const SHOPS: readonly { value: Shop; label: string }[] = [
  { value: "onsite", label: SHOP_NAME.onsite },
  { value: "airplus", label: SHOP_NAME.airplus },
];

const leave = () => (router.canGoBack() ? router.back() : router.replace(BASE as never));

/** A slip just picked on the phone: the file to send and a picture to show until then. */
interface Picked {
  blob: Blob;
  uri: string;
}

/**
 * The expense form (canvas v298): ร้าน first, then รายการ (owner, 2 Nov: "shop and รายการ swap
 * position"), จำนวนเงิน, วันที่, หมายเหตุ, and the slip — not required; once attached it shows big
 * with ⬇ and 📎, as on พนักงาน. บันทึก names only the boxes still empty.
 */
function ExpenseForm(props: {
  title: Phrase;
  start: ExpenseDraft;
  id: string | null;
  /** The slip already kept, when editing. */
  hasSlip: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const { toast, showToast } = useToast();
  const [draft, setDraft] = useState(props.start);
  const [picked, setPicked] = useState<Picked | null>(null);
  // Once a new expense is saved it has an id: a second บันทึก (after its slip failed) must not
  // book it twice.
  const [savedId, setSavedId] = useState(props.id);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const problems = tried ? expenseProblems(draft) : {};
  const change = (patch: Partial<ExpenseDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const pick = async (source: "camera" | "library") => {
    const blob = await pickPhoto(source);
    if (blob) setPicked({ blob, uri: photoPreview(blob) });
  };

  const save = async () => {
    setTried(true);
    if (busy || Object.keys(expenseProblems(draft)).length > 0) return;
    setBusy(true);
    try {
      const saved = await saveExpense(fetch, API_BASE, token, savedId, expenseBody(draft));
      const id = savedId ?? saved?.id ?? null;
      setSavedId(id);
      if (picked && id) await putExpenseSlip(fetch, API_BASE, token, id, picked.blob);
      props.onSaved();
    } catch {
      showToast({ th: "บันทึกไม่สำเร็จ", en: "Not saved" }, { th: "ลองอีกครั้ง", en: "Try again" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPage
      title={t(props.title)}
      onCancel={props.onCancel}
      save={{ label: t({ th: "บันทึก", en: "Save" }), onPress: () => void save() }}
      toast={toast ? { title: t(toast.title), detail: t(toast.detail) } : null}
    >
      <View style={styles.first}>
        <Heading text={t({ th: "ร้าน", en: "Shop" })} />
        <Segmented
          label={t({ th: "ร้าน", en: "Shop" })}
          options={SHOPS}
          value={draft.channel}
          onChange={(channel) => change({ channel })}
        />
      </View>

      <View style={styles.after}>
        <Group>
          <InputRow
            label={t({ th: "รายการ", en: "What for" })}
            value={draft.name}
            placeholder={t({ th: "เช่น ค่าไฟร้าน", en: "e.g. shop electricity" })}
            onChange={(name) => change({ name })}
            last
          />
        </Group>
      </View>
      {problems.name ? <FieldError text={t(problems.name)} /> : null}

      <View style={styles.after}>
        <Group>
          <InputRow
            label={t({ th: "จำนวนเงิน", en: "Amount" })}
            value={draft.amount}
            placeholder={t({ th: "เช่น 1,200", en: "e.g. 1,200" })}
            keyboardType="decimal-pad"
            lead="฿"
            onChange={(amount) => change({ amount })}
          />
          <Line
            label={t({ th: "วันที่", en: "Date" })}
            right={
              <DateBox
                value={draft.day}
                label={t({ th: "วันที่", en: "Date" })}
                onChange={(day) => (day == null ? undefined : change({ day }))}
              />
            }
          />
          <InputRow
            label={t({ th: "หมายเหตุ", en: "Note" })}
            value={draft.note}
            placeholder={t({ th: "ไม่ใส่ก็ได้", en: "Optional" })}
            onChange={(note) => change({ note })}
            last
          />
        </Group>
      </View>
      {problems.amount ? <FieldError text={t(problems.amount)} /> : null}

      <View style={styles.after}>
        {picked || (savedId && props.hasSlip) ? (
          <SlipCard
            uri={picked?.uri ?? null}
            path={picked ? null : expenseSlipPath(savedId!)}
            fileName={`สลิป ${draft.name.trim() || "ค่าใช้จ่าย"}`}
            change={
              <PhotoChoice onChoose={(s) => void pick(s)}>
                {(open) => (
                  <IconButton
                    icon={STAFF_ICON.attach}
                    label={t({ th: "เปลี่ยนรูป", en: "Change picture" })}
                    onPress={open}
                  />
                )}
              </PhotoChoice>
            }
          />
        ) : (
          <Group>
            <Line
              label={t({ th: "สลิป", en: "Slip" })}
              last
              right={
                <PhotoChoice onChoose={(s) => void pick(s)}>
                  {(open) => (
                    <PillButton label={t({ th: "แนบสลิป", en: "Attach slip" })} onPress={open} />
                  )}
                </PhotoChoice>
              }
            />
          </Group>
        )}
      </View>
    </FormPage>
  );
}

/** ＋ on การเงิน → เพิ่มค่าใช้จ่าย. */
export function NewExpenseScreen() {
  const [start] = useState<ExpenseDraft>(() => ({
    name: "",
    amount: "",
    channel: "onsite",
    day: startOfDay(Date.now()),
    note: "",
  }));
  return (
    <ExpenseForm
      title={{ th: "เพิ่มค่าใช้จ่าย", en: "Add an expense" }}
      start={start}
      id={null}
      hasSlip={false}
      onCancel={leave}
      onSaved={leave}
    />
  );
}

const draftOf = (e: Expense): ExpenseDraft => ({
  name: e.conversion,
  amount: bahtText(e.amountSatang),
  channel: e.channel,
  day: e.occurredAt,
  note: e.note ?? "",
});

/**
 * One expense (canvas v298, row 4): read in the form's order, its slip big under it (⬇ only — 📎
 * is in แก้ไข); แก้ไข turns it into the form.
 */
export function ExpenseScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { toast, showToast } = useToast();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [state, setState] = useState<"loading" | "failed" | "gone" | "ok">("loading");
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const found = (await fetchExpenses(fetch, API_BASE, token)).find((e) => e.id === id) ?? null;
      setExpense(found);
      setState(found ? "ok" : "gone");
    } catch {
      setState("failed");
    }
  }, [token, id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useScreenChrome(null, [], {
    back: { label: t({ th: "การเงิน", en: "Finance" }), onPress: leave },
    ownTitle: true,
    toast: toast ? { title: t(toast.title), detail: t(toast.detail) } : null,
  });

  if (state !== "ok" || !expense) {
    return state === "gone" ? (
      <Text style={[TYPE.subhead, styles.gone, { color: theme.textMuted }]}>
        {t({ th: "ไม่มีค่าใช้จ่ายนี้แล้ว", en: "This expense is gone" })}
      </Text>
    ) : (
      <Loading failed={state === "failed"} onRetry={() => void load()} />
    );
  }

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteExpense(fetch, API_BASE, token, expense.id);
      leave();
    } catch {
      setAsking(false);
      showToast({ th: "ลบไม่สำเร็จ", en: "Not deleted" }, { th: "ลองอีกครั้ง", en: "Try again" });
    } finally {
      setBusy(false);
    }
  };
  const value = (text: string) => (
    <Text style={[TYPE.body, styles.value, { color: theme.text }]}>{text}</Text>
  );

  return (
    <View>
      <Pressable
        onPress={() => setEditing(true)}
        accessibilityRole="button"
        style={[styles.editPill, { backgroundColor: theme.glass, borderColor: theme.glassLine }]}
      >
        <Text style={[TYPE.body, { color: theme.text }]}>{t({ th: "แก้ไข", en: "Edit" })}</Text>
      </Pressable>
      <Text style={[TYPE.title1, styles.title, { color: theme.text }]} accessibilityRole="header">
        {expense.conversion}
      </Text>
      <View style={styles.after}>
        <Group>
          <Line label={t({ th: "ร้าน", en: "Shop" })} right={value(SHOP_NAME[expense.channel])} />
          <Line
            label={t({ th: "จำนวนเงิน", en: "Amount" })}
            right={value(money(expense.amountSatang))}
          />
          <Line
            label={t({ th: "วันที่", en: "Date" })}
            right={value(t(dayPill(expense.occurredAt)))}
          />
          <Line label={t({ th: "หมายเหตุ", en: "Note" })} right={value(expense.note ?? "—")} last />
        </Group>
      </View>
      {expense.hasSlip && (
        <View style={styles.gap}>
          <SlipCard path={expenseSlipPath(expense.id)} fileName={`สลิป ${expense.conversion}`} />
        </View>
      )}
      <View style={styles.gap}>
        <Group>
          <Pressable onPress={() => setAsking(true)} accessibilityRole="button" style={styles.row}>
            <Text style={[TYPE.body, { color: theme.danger }]}>
              {t({ th: "ลบค่าใช้จ่าย", en: "Delete expense" })}
            </Text>
          </Pressable>
        </Group>
      </View>

      {editing && (
        <ExpenseForm
          title={{ th: "แก้ค่าใช้จ่าย", en: "Edit expense" }}
          start={draftOf(expense)}
          id={expense.id}
          hasSlip={expense.hasSlip}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}
      {asking && (
        <Sheet
          title={t({
            th: `ลบค่าใช้จ่าย ${expense.conversion}?`,
            en: `Delete ${expense.conversion}?`,
          })}
          onClose={() => setAsking(false)}
          noPill
        >
          <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={() => void remove()} />
          <BigButton
            label={t({ th: "ยกเลิก", en: "Cancel" })}
            kind="grey"
            onPress={() => setAsking(false)}
          />
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: SPACE.l },
  after: { marginTop: SPACE.xxl },
  gap: { marginTop: SPACE.xl },
  // The frame's back pill is 36 tall with 8 under it; แก้ไข sits on its line, on the right — the
  // pill alone, so nothing laid over the row takes the back pill's tap.
  editPill: {
    alignSelf: "flex-end",
    marginTop: -44,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  } as never,
  title: { marginTop: SPACE.m, marginHorizontal: 2 },
  value: { flexShrink: 1, textAlign: "right" },
  row: { minHeight: 52, paddingHorizontal: SPACE.l, justifyContent: "center" },
  gone: { textAlign: "center", marginTop: SPACE.xxxl },
});
