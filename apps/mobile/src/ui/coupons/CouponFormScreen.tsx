import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { windowLabel } from "@/lib/bannerPage";
import { cleanCode, cleanCount, cleanMoney } from "@/lib/couponPage";
import { cutsPatch, scopeLine, whoLine } from "@/lib/couponRules";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { WhenSheet } from "../banners/WhenSheet";
import { Empty } from "../customers/parts";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { ChoiceRow, FieldError } from "../pos/fields";
import { FormPage } from "../products/FormPage";
import { Heading, InputRow, SwitchRow } from "../products/parts";
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
  const title = edit.isNew
    ? t({ th: "เพิ่มคูปอง", en: "Add a coupon" })
    : t({ th: "แก้คูปอง", en: "Edit coupon" });

  if (!edit.form) {
    return (
      <FormPage title={title} onCancel={edit.leave}>
        {edit.problem === "gone" ? (
          <Empty
            icon={ICON.search}
            title={t({ th: "ไม่มีคูปองนี้แล้ว", en: "This coupon is gone" })}
            detail={t({ th: "อาจถูกลบไปแล้ว", en: "It may have been deleted" })}
          />
        ) : edit.problem === "failed" ? (
          <Retry onPress={() => void edit.reload()} />
        ) : (
          <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
        )}
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

function Fields({ edit }: { edit: CouponFormState }) {
  const { t } = useLang();
  const f = edit.form!;
  const e = edit.errors;
  const percent = f.kind === "percent";
  const shipping = f.cuts === "shipping";
  const times = (v: string) => (v ? t({ th: "ครั้ง", en: "times" }) : undefined);
  return (
    <>
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

      <Heading text={t({ th: "ประเภท", en: "Type" })} />
      <View style={styles.seg}>
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

      <Heading text={t({ th: "ส่วนลด", en: "Discount" })} />
      <View style={styles.seg}>
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

      <Heading text={t({ th: "โค้ดและสิทธิ์", en: "Code and limits" })} />
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

      {!edit.isNew && (
        <View style={styles.on}>
          <Group>
            <SwitchRow
              label={t({ th: "เปิดใช้", en: "On" })}
              value={f.on}
              onChange={(on) => edit.set({ on })}
              last
            />
          </Group>
        </View>
      )}
      <Sheets edit={edit} />
    </>
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
});
