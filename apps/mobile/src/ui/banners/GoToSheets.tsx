import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AIRPLUS_PAGES,
  choiceLabel,
  externalProblem,
  productChoices,
  type LinkChoice,
  type LinkNames,
} from "@/lib/bannerPage";
import { formatBaht } from "@/lib/money";
import type { ProductRow } from "@/lib/productList";
import { attrLabel, pickList, type Named } from "@/lib/productPickers";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError, FieldRow } from "../pos/fields";
import { Photo, SearchBox } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import type { PickLists } from "./useBannerForm";
import { CodeCopy } from "../CodeCopy";

type Step = "types" | "airplus" | "brand" | "category" | "car" | "product" | "external";

const AIRPLUS_KINDS = new Set(["page", "brand", "category", "car"]);

/** The names ไปที่ shows, from whatever lists have loaded. */
export function linkNames(lists: PickLists | null): LinkNames {
  return {
    brands: lists?.brands ?? [],
    types: lists?.types ?? [],
    products: lists?.products ?? [],
  };
}

/**
 * ไปที่ (canvas v245, แบนเนอร์ 3–4): คลิกไม่ได้ · AirPlus › · สินค้า › · ลิงก์ภายนอก ›. Each › opens the
 * next sheet (‹ กลับ steps back); ✓ on any of them puts the ticked choice on the form.
 */
export function GoToSheets(props: {
  current: LinkChoice;
  lists: PickLists | null;
  listsFailed: boolean;
  onRetry: () => void;
  onPick: (choice: LinkChoice) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [step, setStep] = useState<Step>("types");
  const [draft, setDraft] = useState<LinkChoice>(props.current);
  const [q, setQ] = useState("");
  const [url, setUrl] = useState(props.current.kind === "external" ? props.current.url : "");
  const [urlError, setUrlError] = useState(false);
  const names = linkNames(props.lists);
  const label = (c: LinkChoice) => t(choiceLabel(c, names));
  const go = (next: Step) => {
    setQ("");
    setStep(next);
  };
  const back = { label: t({ th: "‹ กลับ", en: "‹ Back" }) };
  const done = () => props.onPick(draft);

  if (step === "types") {
    const onAirPlus = AIRPLUS_KINDS.has(draft.kind);
    return (
      <Sheet title={t({ th: "ไปที่", en: "Goes to" })} onClose={props.onClose} onDone={done}>
        <Group>
          <ChoiceLine
            label={t({ th: "คลิกไม่ได้", en: "No tap" })}
            checked={draft.kind === "none"}
            onPress={() => setDraft({ kind: "none" })}
          />
          <ChoiceLine
            label="AirPlus"
            sub={onAirPlus ? label(draft) : undefined}
            checked={onAirPlus}
            opens
            onPress={() => go("airplus")}
          />
          <ChoiceLine
            label={t({ th: "สินค้า", en: "Product" })}
            sub={draft.kind === "product" ? label(draft) : undefined}
            checked={draft.kind === "product"}
            opens
            onPress={() => go("product")}
          />
          <ChoiceLine
            label={t({ th: "ลิงก์ภายนอก", en: "Outside link" })}
            sub={draft.kind === "external" ? label(draft) : undefined}
            checked={draft.kind === "external"}
            opens
            onPress={() => go("external")}
            last
          />
        </Group>
      </Sheet>
    );
  }

  if (step === "airplus") {
    const nameOf = (list: readonly Named[], id: string) => {
      const hit = list.find((a) => a.id === id);
      return hit ? t(attrLabel(hit)) : id;
    };
    return (
      <Sheet
        title="AirPlus"
        left={{ ...back, onPress: () => go("types") }}
        onClose={props.onClose}
        onDone={done}
        tall
      >
        <Group>
          {AIRPLUS_PAGES.map((p, i) => (
            <ChoiceLine
              key={p.path}
              label={t(p.label)}
              checked={draft.kind === "page" && draft.path === p.path}
              onPress={() => setDraft({ kind: "page", path: p.path })}
              last={i === AIRPLUS_PAGES.length - 1}
            />
          ))}
        </Group>
        <Group>
          <ChoiceLine
            label={t({ th: "สินค้ายี่ห้อ", en: "Products of a brand" })}
            sub={draft.kind === "brand" ? nameOf(names.brands, draft.id) : undefined}
            checked={draft.kind === "brand"}
            opens
            onPress={() => go("brand")}
          />
          <ChoiceLine
            label={t({ th: "สินค้าในหมวด", en: "Products in a category" })}
            sub={draft.kind === "category" ? nameOf(names.types, draft.id) : undefined}
            checked={draft.kind === "category"}
            opens
            onPress={() => go("category")}
          />
          <ChoiceLine
            label={t({ th: "สินค้าสำหรับรถ", en: "Parts for a car make" })}
            sub={draft.kind === "car" ? draft.name : undefined}
            checked={draft.kind === "car"}
            opens
            onPress={() => go("car")}
            last
          />
        </Group>
      </Sheet>
    );
  }

  if (step === "external") {
    const check = () => {
      if (externalProblem(url)) return setUrlError(true);
      props.onPick({ kind: "external", url: url.trim() });
    };
    return (
      <Sheet
        title={t({ th: "ลิงก์ภายนอก", en: "Outside link" })}
        left={{ ...back, onPress: () => go("types") }}
        onClose={props.onClose}
        onDone={check}
      >
        <Group>
          <FieldRow
            label={t({ th: "ลิงก์", en: "Link" })}
            value={url}
            placeholder="https://"
            keyboardType="url"
            onChange={(v) => {
              setUrl(v);
              setUrlError(false);
            }}
            last
          />
        </Group>
        {urlError && <FieldError text={t(externalProblem(url)!)} />}
      </Sheet>
    );
  }

  // The four pick lists: part brand, part name (หมวด), car make, product.
  const up = step === "product" ? "types" : "airplus";
  const titles: Record<Exclude<Step, "types" | "airplus" | "external">, [string, string]> = {
    brand: [t({ th: "สินค้ายี่ห้อ", en: "Brand" }), t({ th: "ค้นยี่ห้อ", en: "Find a brand" })],
    category: [
      t({ th: "สินค้าในหมวด", en: "Category" }),
      t({ th: "ค้นหมวด", en: "Find a category" }),
    ],
    car: [
      t({ th: "สินค้าสำหรับรถ", en: "Car make" }),
      t({ th: "ค้นยี่ห้อรถ", en: "Find a car make" }),
    ],
    product: [t({ th: "สินค้า", en: "Product" }), t({ th: "ค้นชื่อหรือรหัส", en: "Name or code" })],
  };
  const [title, placeholder] = titles[step];
  return (
    <Sheet
      title={title}
      left={{ ...back, onPress: () => go(up) }}
      onClose={props.onClose}
      onDone={done}
      tall
    >
      <SearchBox value={q} onChange={setQ} placeholder={placeholder} />
      {!props.lists ? (
        props.listsFailed ? (
          <Retry onPress={props.onRetry} />
        ) : (
          <ActivityIndicator style={{ marginTop: SPACE.xl }} />
        )
      ) : step === "product" ? (
        <ProductList
          rows={productChoices(props.lists.products, q)}
          q={q}
          picked={draft.kind === "product" ? draft.id : null}
          onPick={(id) => setDraft({ kind: "product", id })}
        />
      ) : step === "car" ? (
        <NameList
          names={props.lists.cars
            .filter((c) => c.toLowerCase().includes(q.trim().toLowerCase()))
            .sort((a, b) => a.localeCompare(b, "th"))
            .map((c) => ({ key: c, label: c }))}
          q={q}
          picked={draft.kind === "car" ? draft.name : null}
          onPick={(name) => setDraft({ kind: "car", name })}
        />
      ) : (
        <NameList
          names={named(step === "brand" ? props.lists.brands : props.lists.types, q, t)}
          q={q}
          picked={draft.kind === step ? draft.id : null}
          onPick={(id) =>
            setDraft(step === "brand" ? { kind: "brand", id } : { kind: "category", id })
          }
        />
      )}
    </Sheet>
  );
}

/** A brand or part-name list in Thai order, by the id the website reads. */
function named(list: readonly Named[], q: string, t: (p: { th: string; en: string }) => string) {
  return pickList(list, q)
    .map((a) => ({ key: a.id, label: t(attrLabel(a)) }))
    .sort((a, b) => a.label.localeCompare(b.label, "th"));
}

export function NotFound({ q }: { q: string }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <Text style={[TYPE.title2, styles.notFound, { color: theme.text }]}>
      {t({ th: `ไม่พบ “${q.trim()}”`, en: `No “${q.trim()}”` })}
    </Text>
  );
}

function NameList(props: {
  names: { key: string; label: string }[];
  q: string;
  picked: string | null;
  onPick: (key: string) => void;
}) {
  if (props.names.length === 0 && props.q.trim()) return <NotFound q={props.q} />;
  return (
    <Group>
      {props.names.map((n, i) => (
        <ChoiceLine
          key={n.key}
          label={n.label}
          checked={props.picked === n.key}
          onPress={() => props.onPick(n.key)}
          last={i === props.names.length - 1}
        />
      ))}
    </Group>
  );
}

/** สินค้า: one tick at a time; each product with its photo, code and AirPlus price. */
function ProductList(props: {
  rows: ProductRow[];
  q: string;
  picked: string | null;
  onPick: (id: string) => void;
}) {
  if (props.rows.length === 0 && props.q.trim()) return <NotFound q={props.q} />;
  return (
    <Group>
      {props.rows.map((r, i) => (
        <ProductLine
          key={r.id}
          product={r}
          checked={props.picked === r.id}
          onPress={() => props.onPick(r.id)}
          last={i === props.rows.length - 1}
        />
      ))}
    </Group>
  );
}

/**
 * A product with its photo (grey when it has none), its name (regular, 2 lines), then its code and
 * its AirPlus price, each on a grey line of its own (owner, 4 Nov: long names, alike but for the code).
 */
export function ProductLine(props: {
  product: Pick<ProductRow, "name" | "imageKey" | "productRef" | "onlinePriceSatang">;
  checked?: boolean;
  onPress?: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const body = (
    <View style={styles.product}>
      <Photo imageKey={props.product.imageKey} size={48} radius={10} />
      <View style={styles.text}>
        <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={2}>
          {props.product.name}
        </Text>
        <CodeCopy
          code={props.product.productRef}
          style={[TYPE.subhead, { color: theme.textMuted }]}
        />
        <Text style={[TYPE.subhead, styles.nums, { color: theme.textMuted }]} numberOfLines={1}>
          {formatBaht(props.product.onlinePriceSatang)}
        </Text>
      </View>
      {props.checked && (
        <LineIcon d={ICON.check} color={theme.primary} size={18} strokeWidth={2.6} />
      )}
    </View>
  );
  return (
    <View>
      {props.onPress ? (
        <Pressable onPress={props.onPress} accessibilityRole="link">
          {body}
        </Pressable>
      ) : (
        body
      )}
      {!props.last && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
    </View>
  );
}

/**
 * A choice: its name, the current pick in grey under it, the red ✓ when ticked, › when it opens more.
 * `wrap` lets a longer grey line run onto more lines (คูปอง's ใครใช้ได้).
 */
export function ChoiceLine(props: {
  label: string;
  sub?: string;
  checked?: boolean;
  opens?: boolean;
  onPress: () => void;
  last?: boolean;
  wrap?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: !!props.checked }}
        style={[styles.line, props.sub ? styles.two : null]}
      >
        <View style={styles.text}>
          <Text style={[TYPE.body, { color: theme.text }]}>{props.label}</Text>
          {props.sub ? (
            <Text
              style={[TYPE.subhead, { color: theme.textMuted }]}
              numberOfLines={props.wrap ? undefined : 1}
            >
              {props.sub}
            </Text>
          ) : null}
        </View>
        {props.checked && (
          <LineIcon d={ICON.check} color={theme.primary} size={18} strokeWidth={2.6} />
        )}
        {props.opens && (
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        )}
      </Pressable>
      {!props.last && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  two: { minHeight: 68, paddingVertical: 6 },
  text: { flex: 1, minWidth: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: SPACE.l },
  product: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingVertical: 10,
    paddingHorizontal: SPACE.l,
  },
  nums: { fontVariant: ["tabular-nums"] },
  notFound: { textAlign: "center", paddingVertical: SPACE.xxxl },
});
