import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  capLine,
  formWindow,
  lineOf,
  offPercent,
  soldLine,
  toSatang,
  type FlashLine,
} from "@/lib/flashPage";
import { formatBaht } from "@/lib/money";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { WhenSheet } from "../banners/WhenSheet";
import { Empty } from "../customers/parts";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { ChoiceRow, FieldError } from "../pos/fields";
import { FormPage } from "../products/FormPage";
import { AddRow, Heading, InputRow, SwitchRow } from "../products/parts";
import { useRights } from "../products/useRights";
import { SPACE } from "../theme";
import { ItemRow } from "./parts";
import { AddProductSheet, PriceSheet } from "./sheets";
import { useFlashForm, type FlashFormState } from "./useFlashForm";

/** แคมเปญใหม่ (no id) or แก้แคมเปญ — one form (canvas v259); เปิดใช้ only once the sale exists. */
export function FlashFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useLang();
  const { theme } = useTheme();
  const edit = useFlashForm(id ?? null);
  const title = edit.isNew
    ? t({ th: "แคมเปญใหม่", en: "New sale" })
    : t({ th: "แก้แคมเปญ", en: "Edit sale" });

  if (!edit.form) {
    return (
      <FormPage title={title} onCancel={edit.leave}>
        {edit.problem === "gone" ? (
          <Empty
            icon={ICON.search}
            title={t({ th: "ไม่มีแคมเปญนี้แล้ว", en: "This sale is gone" })}
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
      <Sheets edit={edit} />
    </FormPage>
  );
}

function Fields({ edit }: { edit: FlashFormState }) {
  const { t } = useLang();
  const f = edit.form!;
  const e = edit.errors;
  const count = f.lines.length;
  return (
    <>
      <Group>
        <InputRow
          label={t({ th: "ชื่อแคมเปญ", en: "Name" })}
          value={f.name}
          placeholder={t({ th: "เช่น แฟลชเซล 12.12", en: "e.g. Flash sale 12.12" })}
          onChange={(name) => edit.set({ name })}
          last
        />
      </Group>
      {e.name && <FieldError text={t(e.name)} />}

      <View style={styles.when}>
        <Group>
          <ChoiceRow
            label={t({ th: "ช่วงเวลา", en: "When" })}
            value={t(formWindow(f.startsAt, f.endsAt))}
            onPress={() => edit.setSheet({ kind: "when" })}
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
      {e.when && <FieldError text={t(e.when)} />}

      <Heading
        text={
          count > 0
            ? t({ th: `สินค้า · ${count}`, en: `Products · ${count}` })
            : t({ th: "สินค้า", en: "Products" })
        }
      />
      <Group>
        {f.lines.map((l, i) => (
          <ItemRow
            key={l.productVariantId}
            name={l.name}
            imageKey={l.imageKey}
            off={`${offPercent(l.basePriceSatang, toSatang(l.sale))}%`}
            price={formatBaht(toSatang(l.sale))}
            base={formatBaht(l.basePriceSatang)}
            sub={t(lineSub(l))}
            onPress={() => edit.setSheet({ kind: "line", index: i })}
            onRemove={() => edit.removeLine(i)}
          />
        ))}
        <AddRow
          label={t({ th: "เพิ่มสินค้า", en: "Add a product" })}
          onPress={() => edit.setSheet({ kind: "add" })}
        />
      </Group>
      {e.lines && <FieldError text={t(e.lines)} />}
    </>
  );
}

/** A product already in the sale says how many sold; one picked now, its limit. */
const lineSub = (l: FlashLine) =>
  l.priceId
    ? soldLine({ soldCount: l.soldCount, stockCap: l.cap ? Number(l.cap) : null })
    : capLine(l.cap);

/** Whatever is open over the form: ช่วงเวลา, เพิ่มสินค้า, or ราคาลด. */
function Sheets({ edit }: { edit: FlashFormState }) {
  const { seesCost } = useRights();
  const f = edit.form!;
  const sheet = edit.sheet;
  const close = () => edit.setSheet(null);
  if (!sheet) return null;
  if (sheet.kind === "when") {
    return (
      <WhenSheet
        required
        startsAt={f.startsAt}
        endsAt={f.endsAt}
        onApply={(window) => {
          edit.set(window);
          close();
        }}
        onClose={close}
      />
    );
  }
  if (sheet.kind === "add") {
    return (
      <AddProductSheet
        rows={edit.products}
        failed={edit.productsFailed}
        onRetry={() => void edit.reloadProducts()}
        query={edit.query}
        onQuery={edit.setQuery}
        inSale={new Set(f.lines.map((l) => l.productVariantId))}
        onPick={(row) => edit.setSheet({ kind: "price", row })}
        onClose={close}
      />
    );
  }
  if (sheet.kind === "price") {
    return (
      <PriceSheet
        line={lineOf(sheet.row, "", "")}
        product={sheet.row}
        seesCost={seesCost}
        onBack={() => edit.setSheet({ kind: "add" })}
        onClose={close}
        onDone={(sale, cap) => edit.addLine(sheet.row, sale, cap)}
      />
    );
  }
  const line = f.lines[sheet.index];
  if (!line) return null;
  return (
    <PriceSheet
      line={line}
      product={edit.products?.find((r) => r.variantId === line.productVariantId) ?? null}
      seesCost={seesCost}
      onClose={close}
      onDone={(sale, cap) => edit.changeLine(sheet.index, sale, cap)}
    />
  );
}

const styles = StyleSheet.create({
  when: { marginTop: SPACE.xl + SPACE.xs },
});
