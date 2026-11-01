import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { productChoices } from "@/lib/bannerPage";
import {
  SCOPES,
  carModelChoices,
  pickedLine,
  scopeProblem,
  toggleTarget,
  type CouponScope,
  type CouponTarget,
} from "@/lib/couponRules";
import type { ProductRow } from "@/lib/productList";
import type { Named } from "@/lib/productPickers";
import type { CarBrand } from "@/lib/productsApi";
import { useLang } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { ChoiceLine, NotFound, ProductLine } from "../banners/GoToSheets";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { SearchBox } from "../products/parts";
import { SPACE } from "../theme";

/** What ใช้กับ picks from: part brands, categories, car makes with their models, the catalogue. */
export interface RuleLists {
  brands: Named[];
  types: Named[];
  cars: CarBrand[];
  products: ProductRow[];
}

type Picked = Exclude<CouponScope, "all">;

/** A brand or category as a coupon keeps it: by id, under its Thai name (as the coupon page reads). */
const asTarget = (a: Named): CouponTarget => ({
  id: a.id,
  name: a.nameTh?.trim() || a.name,
  imageKey: null,
});

/**
 * ใช้กับ (canvas v260, คูปอง 4): ทุกสินค้า puts it straight on the form; ยี่ห้อ, หมวดสินค้า, รุ่นรถ and
 * เลือกสินค้า each open their list (‹ ใช้กับ steps back), where several can be ticked and the red ✓
 * puts them on the form.
 */
export function ScopeSheet(props: {
  scope: CouponScope;
  targets: CouponTarget[];
  lists: RuleLists | null;
  listsFailed: boolean;
  onRetry: () => void;
  onPick: (rule: { scope: CouponScope; targets: CouponTarget[] }) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [step, setStep] = useState<Picked | null>(null);
  const [draft, setDraft] = useState<CouponTarget[]>([]);
  const [q, setQ] = useState("");
  const [problem, setProblem] = useState<Phrase | null>(null);

  const open = (scope: Picked) => {
    setDraft(props.scope === scope ? props.targets : []);
    setQ("");
    setProblem(null);
    setStep(scope);
  };
  const toggle = (target: CouponTarget) => {
    setDraft((d) => toggleTarget(d, target));
    setProblem(null);
  };

  if (!step) {
    return (
      <Sheet title={t({ th: "ใช้กับ", en: "For" })} onClose={props.onClose}>
        <Group>
          {SCOPES.map((s, i) => {
            const current = props.scope === s.key;
            const sub =
              s.key === "all"
                ? { th: "ยกเว้นสินค้าราคาแฟลชเซล", en: "Except flash-sale prices" }
                : current
                  ? pickedLine(s.key, props.targets)
                  : undefined;
            return (
              <ChoiceLine
                key={s.key}
                label={t(s.label)}
                sub={sub ? t(sub) : undefined}
                checked={current}
                opens={s.key !== "all" && !current}
                onPress={() =>
                  s.key === "all" ? props.onPick({ scope: "all", targets: [] }) : open(s.key)
                }
                last={i === SCOPES.length - 1}
              />
            );
          })}
        </Group>
      </Sheet>
    );
  }

  const done = () => {
    const missing = scopeProblem(step, draft);
    if (missing) return setProblem(missing);
    props.onPick({ scope: step, targets: draft });
  };
  const ticked = (id: string) => draft.some((d) => d.id === id);
  return (
    <Sheet
      title={t(SCOPES.find((s) => s.key === step)!.label)}
      left={{ label: t({ th: "‹ ใช้กับ", en: "‹ For" }), onPress: () => setStep(null) }}
      onClose={props.onClose}
      onDone={done}
      tall
    >
      {step === "products" && (
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={t({ th: "ค้นชื่อหรือรหัส", en: "Name or code" })}
        />
      )}
      {problem && <FieldError text={t(problem)} />}
      {!props.lists ? (
        props.listsFailed ? (
          <Retry onPress={props.onRetry} />
        ) : (
          <ActivityIndicator style={{ marginTop: SPACE.xl }} />
        )
      ) : step === "products" ? (
        <Products
          rows={productChoices(props.lists.products, q)}
          q={q}
          ticked={ticked}
          onTap={toggle}
        />
      ) : (
        <Names
          names={
            step === "car_model"
              ? carModelChoices(props.lists.cars, "")
              : (step === "brand" ? props.lists.brands : props.lists.types)
                  .map(asTarget)
                  .sort((a, b) => a.name.localeCompare(b.name, "th"))
          }
          ticked={ticked}
          onTap={toggle}
        />
      )}
    </Sheet>
  );
}

function Names(props: {
  names: CouponTarget[];
  ticked: (id: string) => boolean;
  onTap: (target: CouponTarget) => void;
}) {
  return (
    <Group>
      {props.names.map((n, i) => (
        <ChoiceLine
          key={n.id}
          label={n.name}
          checked={props.ticked(n.id)}
          onPress={() => props.onTap(n)}
          last={i === props.names.length - 1}
        />
      ))}
    </Group>
  );
}

function Products(props: {
  rows: ProductRow[];
  q: string;
  ticked: (id: string) => boolean;
  onTap: (target: CouponTarget) => void;
}) {
  if (props.rows.length === 0 && props.q.trim()) return <NotFound q={props.q} />;
  return (
    <Group>
      {props.rows.map((r, i) => (
        <ProductLine
          key={r.id}
          product={r}
          checked={props.ticked(r.id)}
          onPress={() => props.onTap({ id: r.id, name: r.name, imageKey: r.imageKey })}
          last={i === props.rows.length - 1}
        />
      ))}
    </Group>
  );
}

/** ใครใช้ได้ (canvas v260, คูปอง 5): ทุกคน or ลูกค้าใหม่; a tap puts it on the form. */
export function WhoSheet(props: {
  newCustomers: boolean;
  onPick: (newCustomers: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  return (
    <Sheet title={t({ th: "ใครใช้ได้", en: "Who can use it" })} onClose={props.onClose}>
      <Group>
        <ChoiceLine
          label={t({ th: "ทุกคน", en: "Everyone" })}
          sub={t({ th: "ทุกบัญชีที่ใส่โค้ดนี้", en: "Every account that types the code" })}
          checked={!props.newCustomers}
          onPress={() => props.onPick(false)}
        />
        <ChoiceLine
          label={t({ th: "ลูกค้าใหม่", en: "New customers" })}
          sub={t({
            th: "สมัครในช่วงที่ตั้ง ได้คูปองในคูปองของฉัน ใช้ได้ 1 ปีนับจากวันสมัคร",
            en: "Accounts made in the dates get it on My coupons, for 1 year from joining",
          })}
          checked={props.newCustomers}
          onPress={() => props.onPick(true)}
          wrap
          last
        />
      </Group>
    </Sheet>
  );
}
