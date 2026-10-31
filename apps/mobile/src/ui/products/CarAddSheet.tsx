import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { API_BASE } from "@/lib/config";
import { addFitment } from "@/lib/productEdit";
import { yearRange } from "@/lib/productList";
import { attrLabel, nameTaken, pickList } from "@/lib/productPickers";
import { createCarBrand, createCarModel, type CarBrand, type CarModel } from "@/lib/productsApi";
import { useLang } from "../AppProviders";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { AddRow, InputRow, PickRow, SearchBox } from "./parts";
import type { ProductEdit } from "./useProductEdit";

type Step =
  | { at: "brands" }
  | { at: "newBrand" }
  | { at: "models"; brand: CarBrand }
  | { at: "newModel"; brand: CarBrand };

const fitmentOf = (brand: CarBrand, model: CarModel) => ({
  carBrand: brand.name,
  carModel: model.name,
  yearFrom: model.yearFrom,
  yearTo: model.yearTo,
});

/**
 * ＋ เพิ่มรถ (canvas v194): a car brand, then one model with its years; either can be added new.
 * ✓ puts the car in the product's list. Makes and models show their own names (Toyota Vigo), the
 * way the product's car list prints them.
 */
export function CarAddSheet({ edit }: { edit: ProductEdit }) {
  const { t } = useLang();
  const [step, setStep] = useState<Step>({ at: "brands" });
  const [q, setQ] = useState("");
  const [model, setModel] = useState<CarModel | null>(null);
  const close = () => edit.setSheet(null);
  const brands = edit.cars ?? [];

  const addCar = (brand: CarBrand, m: CarModel) => {
    edit.set({ fitments: addFitment(edit.form!.fitments, fitmentOf(brand, m)) });
    close();
  };
  /** A brand or model made here joins the lists, so it shows next time without a reload. */
  const keep = (next: CarBrand[]) => edit.setCars(next);

  if (step.at === "newBrand") {
    return (
      <NewCarForm
        title={t({ th: "ยี่ห้อรถใหม่", en: "New car make" })}
        back={{
          label: t({ th: "‹ ยี่ห้อรถ", en: "‹ Makes" }),
          onPress: () => setStep({ at: "brands" }),
        }}
        taken={(en, th) => nameTaken(brands, en, th)}
        onClose={close}
        make={async (en, th) => {
          const made = await createCarBrand(fetch, API_BASE, edit.token, en, th);
          keep([...brands, made]);
          setStep({ at: "models", brand: made });
        }}
      />
    );
  }
  if (step.at === "newModel") {
    const brand = step.brand;
    return (
      <NewCarForm
        title={t({ th: "รุ่นใหม่", en: "New model" })}
        back={{
          label: `‹ ${brand.name}`,
          onPress: () => setStep({ at: "models", brand }),
        }}
        brand={brand.name}
        withYears
        taken={(en, th) => nameTaken(brand.models, en, th)}
        onClose={close}
        make={async (en, th, from, to) => {
          const made = await createCarModel(fetch, API_BASE, edit.token, brand.id, {
            nameEn: en,
            nameTh: th,
            yearFrom: from,
            yearTo: to,
          });
          keep(brands.map((b) => (b.id === brand.id ? { ...b, models: [...b.models, made] } : b)));
          addCar(brand, made);
        }}
      />
    );
  }
  if (step.at === "models") {
    const brand = step.brand;
    const models = pickList(brand.models, q);
    return (
      <Sheet
        title={brand.name}
        left={{
          label: t({ th: "‹ ยี่ห้อรถ", en: "‹ Makes" }),
          onPress: () => setStep({ at: "brands" }),
        }}
        onClose={close}
        onDone={() => (model ? addCar(brand, model) : close())}
        tall
      >
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={t({ th: "ค้นรุ่น", en: "Find a model" })}
        />
        <Group>
          {models.map((m) => (
            <PickRow
              key={m.id}
              label={m.name}
              sub={yearRange(m.yearFrom, m.yearTo)}
              checked={model?.id === m.id}
              onPress={() => setModel(model?.id === m.id ? null : m)}
            />
          ))}
          <AddRow
            label={t({ th: "เพิ่มรุ่นใหม่", en: "Add a new model" })}
            onPress={() => setStep({ at: "newModel", brand })}
          />
        </Group>
      </Sheet>
    );
  }
  const shown = pickList(brands, q);
  return (
    <Sheet title={t({ th: "ยี่ห้อรถ", en: "Car make" })} onClose={close} tall>
      <SearchBox
        value={q}
        onChange={setQ}
        placeholder={t({ th: "ค้นยี่ห้อรถ", en: "Find a make" })}
      />
      <Group>
        {shown.map((b) => (
          <PickRow
            key={b.id}
            label={b.name}
            opens
            onPress={() => {
              setQ("");
              setModel(null);
              setStep({ at: "models", brand: b });
            }}
          />
        ))}
        <AddRow
          label={t({ th: "เพิ่มยี่ห้อรถใหม่", en: "Add a new make" })}
          onPress={() => setStep({ at: "newBrand" })}
        />
      </Group>
    </Sheet>
  );
}

const year = (text: string): number | null | "bad" => {
  const raw = text.trim();
  if (!raw) return null;
  return /^\d{4}$/.test(raw) ? Number(raw) : "bad";
};

/** A new car make (English and Thai), or a new model (also its first and last year). */
function NewCarForm(props: {
  title: string;
  back: { label: string; onPress: () => void };
  brand?: string;
  withYears?: boolean;
  taken: (
    en: string,
    th: string,
  ) => { nameTh: string | null; name: string; nameEn: string | null } | null;
  onClose: () => void;
  make: (en: string, th: string, from: number | null, to: number | null) => Promise<void>;
}) {
  const { t } = useLang();
  const [en, setEn] = useState("");
  const [th, setTh] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [problem, setProblem] = useState<Phrase | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = (set: (v: string) => void) => (v: string) => {
    set(v);
    setProblem(null);
  };

  const done = async () => {
    if (busy) return;
    if (!en.trim()) return setProblem({ th: "ใส่ชื่ออังกฤษก่อน", en: "Add the English name" });
    const yf = year(from);
    const yt = year(to);
    if (yf === "bad" || yt === "bad")
      return setProblem({
        th: "ปีใส่เป็นตัวเลข 4 หลัก เช่น 2022",
        en: "Years are 4 digits, e.g. 2022",
      });
    if (yf != null && yt != null && yt < yf)
      return setProblem({
        th: "ปีสิ้นสุดต้องไม่ก่อนปีเริ่ม",
        en: "The last year can't be before the first",
      });
    const hit = props.taken(en, th);
    if (hit) {
      const shown = attrLabel({ id: "", ...hit });
      return setProblem({
        th: `มี “${shown.th}” แล้ว · เลือกจากรายการ`,
        en: `“${shown.en}” is already there · pick it from the list`,
      });
    }
    setBusy(true);
    try {
      await props.make(en, th, yf, yt);
    } catch (e) {
      const why = e instanceof Error ? e.message : "";
      setProblem({ th: why || "เพิ่มไม่สำเร็จ", en: why || "Not added" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={props.title}
      left={props.back}
      onClose={props.onClose}
      onDone={() => void done()}
      tall
    >
      <Group>
        {props.brand && (
          <InputRow
            label={t({ th: "ยี่ห้อ", en: "Make" })}
            value={props.brand}
            editable={false}
            onChange={() => undefined}
          />
        )}
        <InputRow
          label={t({ th: "ชื่ออังกฤษ", en: "English name" })}
          value={en}
          onChange={typed(setEn)}
        />
        <InputRow
          label={t({ th: "ชื่อไทย", en: "Thai name" })}
          value={th}
          onChange={typed(setTh)}
          last={!props.withYears}
        />
        {props.withYears && (
          <>
            <InputRow
              label={t({ th: "ปีเริ่ม", en: "First year" })}
              value={from}
              keyboardType="number-pad"
              onChange={typed(setFrom)}
            />
            <InputRow
              label={t({ th: "ปีสิ้นสุด", en: "Last year" })}
              value={to}
              placeholder={t({ th: "ไม่บังคับ", en: "Optional" })}
              keyboardType="number-pad"
              onChange={typed(setTo)}
              last
            />
          </>
        )}
      </Group>
      {problem && <FieldError text={t(problem)} />}
    </Sheet>
  );
}
