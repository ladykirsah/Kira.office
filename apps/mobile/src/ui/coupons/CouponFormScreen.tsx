import { useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { windowLabel } from "@/lib/bannerPage";
import { cleanCode, cleanCount, cleanMoney } from "@/lib/couponPage";
import { cutsPatch, scopeLine, whoLine } from "@/lib/couponRules";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { WhenSheet } from "../banners/WhenSheet";
import { Empty } from "../customers/parts";
import { DeskCard } from "../desk/DeskCard";
import { useWide } from "../desk/useWide";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { ChoiceRow, FieldError } from "../pos/fields";
import { FormPage } from "../products/FormPage";
import { Heading, InputRow, SwitchRow } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { SPACE } from "../theme";
import { ScopeSheet, WhoSheet } from "./RuleSheets";
import { useCouponForm, type CouponFormState } from "./useCouponForm";

/**
 * เพิ่มคูปอง (no id) or แก้คูปอง — one form (canvas v266): ชื่อคูปอง, ประเภท (ราคาสินค้า or ค่าส่ง, ใช้กับ,
 * ใครใช้ได้, ช่วงเวลา), ส่วนลด, โค้ดและสิทธิ์, and on แก้คูปอง เปิดใช้ alone; the code is locked once made.
 */
export function CouponFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useLang();
  const { theme } = useTheme();
  const edit = useCouponForm(id ?? null);
  const wide = useWide();
  const title = edit.isNew
    ? t({ th: "เพิ่มคูปอง", en: "Add a coupon" })
    : t({ th: "แก้คูปอง", en: "Edit coupon" });

  const waiting =
    edit.problem === "gone" ? (
      <Empty
        icon={ICON.search}
        title={t({ th: "ไม่มีคูปองนี้แล้ว", en: "This coupon is gone" })}
        detail={t({ th: "อาจถูกลบไปแล้ว", en: "It may have been deleted" })}
      />
    ) : edit.problem === "failed" ? (
      <Retry onPress={() => void edit.reload()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  if (wide) {
    return (
      <WidePage edit={edit} title={title}>
        {edit.form ? <WideFields edit={edit} /> : waiting}
      </WidePage>
    );
  }
  if (!edit.form) {
    return (
      <FormPage title={title} onCancel={edit.leave}>
        {waiting}
      </FormPage>
    );
  }
  return (
    <FormPage
      title={title}
      onCancel={edit.leave}
      save={{ label: t({ th: "บันทึก", en: "Save" }), onPress: () => void edit.save() }}
      toast={edit.toast ? { title: t(edit.toast.title), detail: t(edit.toast.detail) } : null}
    >
      <Fields edit={edit} />
    </FormPage>
  );
}

/**
 * The form inside the computer's frame (DeskCoupons board 3–4): the title and the way back on top,
 * ยกเลิก and the red บันทึก in the pinned bar, any message beside them.
 */
function WidePage(props: { edit: CouponFormState; title: string; children: ReactNode }) {
  const { t } = useLang();
  const { edit } = props;
  // แก้คูปอง goes back to the coupon's page, named as it was when the form opened (as drawn).
  const [from, setFrom] = useState<string | null>(null);
  useEffect(() => {
    if (from == null && edit.form && !edit.isNew) setFrom(edit.form.name || edit.form.code);
  }, [from, edit.form, edit.isNew]);
  useScreenChrome(
    null,
    edit.form
      ? [
          { label: t({ th: "บันทึก", en: "Save" }), onPress: () => void edit.save() },
          { label: t({ th: "ยกเลิก", en: "Cancel" }), kind: "grey", onPress: edit.leave },
        ]
      : [],
    {
      title: props.title,
      back: { label: from ?? t({ th: "คูปอง", en: "Coupons" }), onPress: edit.leave },
      toast: edit.toast ? { title: t(edit.toast.title), detail: t(edit.toast.detail) } : null,
      layout: "full",
    },
  );
  return <View>{props.children}</View>;
}

/** The phone form: one column, a heading over each group (canvas v266). */
function Fields({ edit }: { edit: CouponFormState }) {
  const { t } = useLang();
  return (
    <>
      <NameBox edit={edit} />
      <Heading text={t({ th: "ประเภท", en: "Type" })} />
      <TypeBox edit={edit} />
      <Heading text={t({ th: "ส่วนลด", en: "Discount" })} />
      <DiscountBox edit={edit} />
      <Heading text={t({ th: "โค้ดและสิทธิ์", en: "Code and limits" })} />
      <CodeBox edit={edit} />
      {!edit.isNew && (
        <View style={styles.on}>
          <OnBox edit={edit} />
        </View>
      )}
      <Sheets edit={edit} />
    </>
  );
}

/** The computer form: name, ประเภท and ส่วนลด on the left; โค้ดและสิทธิ์ and เปิดใช้ on the right. */
function WideFields({ edit }: { edit: CouponFormState }) {
  const { t } = useLang();
  return (
    <>
      <View style={styles.wideRow}>
        <View style={styles.wideMain}>
          <NameBox edit={edit} />
          <DeskCard title={t({ th: "ประเภท", en: "Type" })} pad={18}>
            <TypeBox edit={edit} />
          </DeskCard>
          <DeskCard title={t({ th: "ส่วนลด", en: "Discount" })} pad={18}>
            <DiscountBox edit={edit} />
          </DeskCard>
        </View>
        <View style={styles.wideSide}>
          <DeskCard title={t({ th: "โค้ดและสิทธิ์", en: "Code and limits" })} pad={18}>
            <CodeBox edit={edit} />
          </DeskCard>
          {!edit.isNew && <OnBox edit={edit} />}
        </View>
      </View>
      <Sheets edit={edit} />
    </>
  );
}

function NameBox({ edit }: { edit: CouponFormState }) {
  const { t } = useLang();
  const f = edit.form!;
  const e = edit.errors;
  return (
    <View>
      <Group>
        <InputRow
          label={t({ th: "ชื่อคูปอง", en: "Name" })}
          value={f.name}
          placeholder={t({ th: "เช่น ลูกค้าใหม่ พ.ย.", en: "e.g. New customers Nov" })}
          onChange={(name) => edit.set({ name })}
          last
        />
      </Group>
      {e.name && <FieldError text={t(e.name)} />}
    </View>
  );
}

function TypeBox({ edit }: { edit: CouponFormState }) {
  const { t } = useLang();
  const wide = useWide();
  const f = edit.form!;
  const e = edit.errors;
  return (
    <View>
      <View style={[styles.seg, wide && styles.wideSeg]}>
        <Segmented
          label={t({ th: "ลดอะไร", en: "Discount on" })}
          options={[
            { value: "product", label: t({ th: "ราคาสินค้า", en: "Product price" }) },
            { value: "shipping", label: t({ th: "ค่าส่ง", en: "Shipping" }) },
          ]}
          value={f.cuts}
          onChange={(cuts) => edit.set(cutsPatch(f.kind, cuts))}
        />
      </View>
      <Group>
        <ChoiceRow
          label={t({ th: "ใช้กับ", en: "For" })}
          value={t(scopeLine(f.scope, f.targets))}
          onPress={() => edit.setSheet("scope")}
        />
        <ChoiceRow
          label={t({ th: "ใครใช้ได้", en: "Who" })}
          value={t(whoLine({ signupFrom: f.newCustomers ? 0 : null }, false))}
          onPress={() => edit.setSheet("who")}
        />
        {f.newCustomers ? (
          <ChoiceRow
            label={t({ th: "สมัครช่วง", en: "Signed up" })}
            value={f.signupFrom == null ? "" : t(windowLabel(f.signupFrom, f.signupTo))}
            onPress={() => edit.setSheet("signup")}
            last
          />
        ) : (
          <ChoiceRow
            label={t({ th: "ช่วงเวลา", en: "When" })}
            value={t(windowLabel(f.startsAt, f.endsAt))}
            onPress={() => edit.setSheet("when")}
            last
          />
        )}
      </Group>
      {e.scope && <FieldError text={t(e.scope)} />}
      {e.when && <FieldError text={t(e.when)} />}
    </View>
  );
}

function DiscountBox({ edit }: { edit: CouponFormState }) {
  const { t } = useLang();
  const wide = useWide();
  const f = edit.form!;
  const e = edit.errors;
  const percent = f.kind === "percent";
  const shipping = f.cuts === "shipping";
  return (
    <View>
      <View style={[styles.seg, wide && styles.wideSeg]}>
        <Segmented
          label={t({ th: "ลดแบบไหน", en: "Discount type" })}
          options={[
            shipping
              ? { value: "free" as const, label: t({ th: "ส่งฟรี", en: "Free" }) }
              : { value: "percent" as const, label: t({ th: "ลดเป็น %", en: "Percent" }) },
            { value: "fixed" as const, label: t({ th: "ลดเป็นบาท", en: "Baht" }) },
          ]}
          value={f.kind}
          onChange={(kind) => edit.set({ kind })}
        />
      </View>
      <Group>
        {f.kind !== "free" && (
          <InputRow
            label={t({ th: "ลด", en: "Off" })}
            value={f.amount}
            placeholder={t(
              percent
                ? { th: "เช่น 10", en: "e.g. 10" }
                : shipping
                  ? { th: "เช่น 30", en: "e.g. 30" }
                  : { th: "เช่น 200", en: "e.g. 200" },
            )}
            unit={percent && f.amount ? "%" : undefined}
            lead={percent ? undefined : "฿"}
            keyboardType="decimal-pad"
            onChange={(v) => edit.set({ amount: cleanMoney(v) })}
          />
        )}
        {percent && (
          <InputRow
            label={t({ th: "ลดสูงสุด", en: "Up to" })}
            value={f.cap}
            placeholder={t({ th: "ไม่จำกัด", en: "No cap" })}
            lead="฿"
            keyboardType="decimal-pad"
            onChange={(v) => edit.set({ cap: cleanMoney(v) })}
          />
        )}
        <InputRow
          label={t({ th: "ซื้อขั้นต่ำ", en: "Minimum" })}
          value={f.minimum}
          placeholder={t({ th: "ไม่มีขั้นต่ำ", en: "No minimum" })}
          lead="฿"
          keyboardType="decimal-pad"
          onChange={(v) => edit.set({ minimum: cleanMoney(v) })}
          last
        />
      </Group>
      {e.amount && <FieldError text={t(e.amount)} />}
    </View>
  );
}

function CodeBox({ edit }: { edit: CouponFormState }) {
  const { t } = useLang();
  const f = edit.form!;
  const e = edit.errors;
  const times = (v: string) => (v ? t({ th: "ครั้ง", en: "times" }) : undefined);
  return (
    <View>
      <Group>
        <InputRow
          label={t({ th: "โค้ด", en: "Code" })}
          value={f.code}
          placeholder={t({ th: "เช่น NEWNOV", en: "e.g. NEWNOV" })}
          editable={edit.isNew}
          onChange={(v) => edit.set({ code: cleanCode(v) })}
        />
        <InputRow
          label={t({ th: "ใช้ได้ทั้งหมด", en: "Uses in all" })}
          value={f.maxUses}
          placeholder={t({ th: "ไม่จำกัด", en: "No limit" })}
          unit={times(f.maxUses)}
          keyboardType="number-pad"
          onChange={(v) => edit.set({ maxUses: cleanCount(v) })}
        />
        <InputRow
          label={t({ th: "ใช้ได้ต่อคน", en: "Per customer" })}
          value={f.perCustomer}
          placeholder="1"
          unit={times(f.perCustomer)}
          keyboardType="number-pad"
          onChange={(v) => edit.set({ perCustomer: cleanCount(v) })}
          last
        />
      </Group>
      {e.code && <FieldError text={t(e.code)} />}
      {edit.taken && <FieldError text={t(edit.taken)} />}
      {e.perCustomer && <FieldError text={t(e.perCustomer)} />}
    </View>
  );
}

/** เปิดใช้ alone, on แก้คูปอง only. */
function OnBox({ edit }: { edit: CouponFormState }) {
  const { t } = useLang();
  return (
    <Group>
      <SwitchRow
        label={t({ th: "เปิดใช้", en: "On" })}
        value={edit.form!.on}
        onChange={(on) => edit.set({ on })}
        last
      />
    </Group>
  );
}

/** The sheet open over the form, if any. */
function Sheets({ edit }: { edit: CouponFormState }) {
  const f = edit.form!;
  const close = () => edit.setSheet(null);
  switch (edit.sheet) {
    case "when":
      return (
        <WhenSheet
          startsAt={f.startsAt}
          endsAt={f.endsAt}
          onApply={(window) => {
            edit.set(window);
            close();
          }}
          onClose={close}
        />
      );
    case "signup":
      return (
        <WhenSheet
          title={{ th: "สมัครช่วง", en: "Signed up" }}
          startsAt={f.signupFrom}
          endsAt={f.signupTo}
          onApply={(window) => {
            edit.set({ signupFrom: window.startsAt, signupTo: window.endsAt });
            close();
          }}
          onClose={close}
          required
        />
      );
    case "scope":
      return (
        <ScopeSheet
          scope={f.scope}
          targets={f.targets}
          lists={edit.lists}
          listsFailed={edit.listsFailed}
          onRetry={() => void edit.reloadLists()}
          onPick={(rule) => {
            edit.set(rule);
            close();
          }}
          onClose={close}
        />
      );
    case "who":
      return (
        <WhoSheet
          newCustomers={f.newCustomers}
          onPick={(newCustomers) => {
            edit.set({ newCustomers });
            close();
          }}
          onClose={close}
        />
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  seg: { marginBottom: SPACE.m },
  on: { marginTop: SPACE.xl + SPACE.xs },
  wideSeg: { maxWidth: 320 },
  wideRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.xl },
  wideMain: { flex: 1.45, minWidth: 0, gap: SPACE.xl },
  wideSide: { flex: 1, minWidth: 0, gap: SPACE.xl },
});
