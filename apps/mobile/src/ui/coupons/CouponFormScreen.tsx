import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { windowLabel } from "@/lib/bannerPage";
import { cleanCode, cleanCount, cleanMoney } from "@/lib/couponPage";
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
import { useCouponForm, type CouponFormState } from "./useCouponForm";

/** เพิ่มคูปอง (no id) or แก้คูปอง — one form (canvas v252); the code is locked once made. */
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

      <Heading text={t({ th: "ส่วนลด", en: "Discount" })} />
      <View style={styles.seg}>
        <Segmented
          label={t({ th: "ลดแบบไหน", en: "Discount type" })}
          options={[
            { value: "percent", label: t({ th: "ลดเป็น %", en: "Percent" }) },
            { value: "fixed", label: t({ th: "ลดเป็นบาท", en: "Baht" }) },
          ]}
          value={f.kind}
          onChange={(kind) => edit.set({ kind })}
        />
      </View>
      <Group>
        <InputRow
          label={t({ th: "ลด", en: "Off" })}
          value={f.amount}
          placeholder={t(
            percent ? { th: "เช่น 10", en: "e.g. 10" } : { th: "เช่น 200", en: "e.g. 200" },
          )}
          unit={percent && f.amount ? "%" : undefined}
          lead={percent ? undefined : "฿"}
          keyboardType="decimal-pad"
          onChange={(v) => edit.set({ amount: cleanMoney(v) })}
        />
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

      <View style={styles.when}>
        <Group>
          <ChoiceRow
            label={t({ th: "ช่วงเวลา", en: "When" })}
            value={t(windowLabel(f.startsAt, f.endsAt))}
            onPress={() => edit.setWhen(true)}
            last={edit.isNew}
          />
          {!edit.isNew && (
            <SwitchRow
              label={t({ th: "เปิดใช้", en: "On" })}
              value={f.on}
              onChange={(on) => edit.set({ on })}
              last
            />
          )}
        </Group>
      </View>
      {edit.when && (
        <WhenSheet
          startsAt={f.startsAt}
          endsAt={f.endsAt}
          onApply={(window) => {
            edit.set(window);
            edit.setWhen(false);
          }}
          onClose={() => edit.setWhen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  seg: { marginBottom: SPACE.m },
  when: { marginTop: SPACE.xl + SPACE.xs },
});
