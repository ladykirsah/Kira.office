import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { carModelOptions, carOptions, countBy, yearRange, type Fitment } from "@/lib/productList";
import { useLang } from "../AppProviders";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { CameraBox } from "../scan/CameraBox";
import { PickRow, SearchBox, SmallHeading } from "./parts";
import type { ProductList } from "./useProductList";

/**
 * สินค้า's filter sheets (canvas v194): ล้าง on the left, the choice in the middle, the red ✓ to use
 * it. Each row counts the products that have it.
 */

const has = (text: string, q: string) => text.toLowerCase().includes(q.trim().toLowerCase());

export function BrandSheet({ list }: { list: ProductList }) {
  const { t } = useLang();
  const [pick, setPick] = useState(list.filters.brand);
  const [q, setQ] = useState("");
  const close = () => list.setSheet(null);
  const options = countBy(list.rows ?? [], (r) => r.brandName).filter((o) =>
    has(list.label("brands", o.value), q),
  );
  return (
    <Sheet
      title={t({ th: "ยี่ห้ออะไหล่", en: "Part brand" })}
      left={{
        label: t({ th: "ล้าง", en: "Clear" }),
        onPress: () => {
          list.setFilters({ ...list.filters, brand: null });
          close();
        },
      }}
      onClose={close}
      onDone={() => {
        list.setFilters({ ...list.filters, brand: pick });
        close();
      }}
      tall
    >
      <SearchBox
        value={q}
        onChange={setQ}
        placeholder={t({ th: "ค้นยี่ห้อ", en: "Find a brand" })}
      />
      <Group>
        {options.map((o, i) => (
          <PickRow
            key={o.value}
            label={list.label("brands", o.value)}
            count={o.count}
            checked={pick === o.value}
            onPress={() => setPick(pick === o.value ? null : o.value)}
            last={i === options.length - 1}
          />
        ))}
      </Group>
    </Sheet>
  );
}

/** ระบบ, and under the chosen system its part names ("ทุกอย่าง" keeps the whole system). */
export function SystemSheet({ list }: { list: ProductList }) {
  const { t } = useLang();
  const [usage, setUsage] = useState(list.filters.usage);
  const [type, setType] = useState(list.filters.type);
  const [q, setQ] = useState("");
  const close = () => list.setSheet(null);
  const rows = list.rows ?? [];
  const systems = countBy(rows, (r) => r.usageName).filter((o) =>
    has(list.label("usages", o.value), q),
  );
  const inSystem = rows.filter((r) => r.usageName === usage);
  const types = countBy(inSystem, (r) => r.typeName).filter((o) =>
    has(list.label("types", o.value), q),
  );
  return (
    <Sheet
      title={t({ th: "ระบบ", en: "System" })}
      left={{
        label: t({ th: "ล้าง", en: "Clear" }),
        onPress: () => {
          list.setFilters({ ...list.filters, usage: null, type: null });
          close();
        },
      }}
      onClose={close}
      onDone={() => {
        list.setFilters({ ...list.filters, usage, type });
        close();
      }}
      tall
    >
      <SearchBox
        value={q}
        onChange={setQ}
        placeholder={t({ th: "ค้นระบบหรือชื่ออะไหล่", en: "Find a system or part name" })}
      />
      <Group>
        {systems.map((o, i) => (
          <PickRow
            key={o.value}
            label={list.label("usages", o.value)}
            count={o.count}
            checked={usage === o.value}
            onPress={() => {
              setUsage(usage === o.value ? null : o.value);
              setType(null);
            }}
            last={i === systems.length - 1}
          />
        ))}
      </Group>
      {usage && (
        <>
          <SmallHeading
            text={t({
              th: `ชื่ออะไหล่ในระบบ${list.label("usages", usage)}`,
              en: `Part names in ${list.label("usages", usage)}`,
            })}
          />
          <Group>
            <PickRow
              label={t({ th: "ทุกอย่าง", en: "Everything" })}
              count={inSystem.length}
              checked={type == null}
              onPress={() => setType(null)}
              last={types.length === 0}
            />
            {types.map((o, i) => (
              <PickRow
                key={o.value}
                label={list.label("types", o.value)}
                count={o.count}
                checked={type === o.value}
                onPress={() => setType(o.value)}
                last={i === types.length - 1}
              />
            ))}
          </Group>
        </>
      )}
    </Sheet>
  );
}

const sameCar = (a: Fitment | null, b: Fitment) =>
  a != null &&
  a.carBrand === b.carBrand &&
  a.carModel === b.carModel &&
  a.yearFrom === b.yearFrom &&
  a.yearTo === b.yearTo;

/** รถ: a car brand, then its models with their years — one model picked. */
export function CarSheet({ list }: { list: ProductList }) {
  const { t } = useLang();
  const [brand, setBrand] = useState<string | null>(list.filters.car?.carBrand ?? null);
  const [car, setCar] = useState<Fitment | null>(list.filters.car);
  const [q, setQ] = useState("");
  const close = () => list.setSheet(null);
  const rows = list.rows ?? [];
  const clear = {
    label: t({ th: "ล้าง", en: "Clear" }),
    onPress: () => {
      list.setFilters({ ...list.filters, car: null });
      close();
    },
  };
  const done = () => {
    list.setFilters({ ...list.filters, car });
    close();
  };
  const title = t({ th: "รถที่ใช้ได้", en: "Fits these cars" });
  if (!brand) {
    const brands = carOptions(rows).filter((o) => has(o.value, q));
    return (
      <Sheet title={title} left={clear} onClose={close} onDone={done} tall>
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={t({ th: "ค้นยี่ห้อหรือรุ่นรถ", en: "Find a make or model" })}
        />
        <Group>
          {brands.map((o, i) => (
            <PickRow
              key={o.value}
              label={o.value}
              count={o.count}
              opens
              onPress={() => {
                setBrand(o.value);
                setQ("");
              }}
              last={i === brands.length - 1}
            />
          ))}
        </Group>
      </Sheet>
    );
  }
  const models = carModelOptions(rows, brand).filter((o) => has(o.car.carModel ?? "", q));
  return (
    <Sheet
      title={title}
      left={{ label: t({ th: "‹ ยี่ห้อรถ", en: "‹ Makes" }), onPress: () => setBrand(null) }}
      onClose={close}
      onDone={done}
      tall
    >
      <SearchBox
        value={q}
        onChange={setQ}
        placeholder={t({ th: "ค้นรุ่นรถ", en: "Find a model" })}
      />
      <SmallHeading text={brand} />
      <Group>
        {models.map((o, i) => (
          <PickRow
            key={`${o.car.carModel}|${o.car.yearFrom}|${o.car.yearTo}`}
            label={[o.car.carModel, yearRange(o.car.yearFrom, o.car.yearTo)]
              .filter(Boolean)
              .join(" ")}
            count={o.count}
            checked={sameCar(car, o.car)}
            onPress={() => setCar(sameCar(car, o.car) ? null : o.car)}
            last={i === models.length - 1}
          />
        ))}
      </Group>
    </Sheet>
  );
}

/** สแกน: the shop's camera box; a code found opens its product. */
export function ScanSheet({ list }: { list: ProductList }) {
  const { t } = useLang();
  return (
    <Sheet
      title={t({ th: "สแกนรหัสสินค้า", en: "Scan a product code" })}
      onClose={() => list.setSheet(null)}
    >
      <View style={styles.camera}>
        <CameraBox height={300} showHint={false} onCode={(code) => void list.scanned(code)} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  camera: { borderRadius: 16, overflow: "hidden" },
});
