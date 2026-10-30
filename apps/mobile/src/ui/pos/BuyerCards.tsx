import { Pressable, StyleSheet, Text, View } from "react-native";
import { initials } from "@/lib/initials";
import { billDate } from "@/lib/scanSale";
import { useLang, useTheme } from "../AppProviders";
import { Group } from "../orders/parts";
import { Segmented } from "../Segmented";
import { SPACE, TYPE } from "../theme";
import { ChoiceRow, FieldRow, Heading, Note } from "./fields";
import { usePos } from "./PosSessionProvider";

const shortDay = (at: number) => billDate(at).date.replace(/ \d{4}$/, "");

/**
 * ขายให้ (owner, 30 Oct 2026: "picked before filling customer details"). ลูกค้า: the plate finds the
 * customer and car; a new plate asks only for รถ + เลขไมล์, name and phone are optional. ช่าง: a
 * name if any, nothing else, and every part at the mechanic price.
 */
export function BuyerSection() {
  const { t } = useLang();
  const pos = usePos();
  return (
    <>
      <Heading text={t({ th: "ขายให้", en: "Sell to" })} />
      <Segmented
        label={t({ th: "ขายให้", en: "Sell to" })}
        options={[
          { value: "customer", label: t({ th: "ลูกค้า", en: "Customer" }) },
          { value: "mechanic", label: t({ th: "ช่าง", en: "Mechanic" }) },
        ]}
        value={pos.bill.buyer}
        onChange={(v) => pos.setBuyer(v as "customer" | "mechanic")}
      />
      <View style={styles.gap} />
      {pos.bill.buyer === "customer" ? <CustomerCards /> : <MechanicCard />}
    </>
  );
}

function MechanicCard() {
  const { t } = useLang();
  const pos = usePos();
  return (
    <>
      <Group>
        <FieldRow
          label={t({ th: "ชื่อช่าง", en: "Mechanic" })}
          value={pos.bill.mechanicName}
          placeholder={t({ th: "ไม่บังคับ", en: "Optional" })}
          onChange={(v) => pos.setBill((b) => ({ ...b, mechanicName: v }))}
          last
        />
      </Group>
      <Note>
        {t({
          th: "ทุกรายการใช้ราคาช่าง · ไม่ต้องใส่รถและเลขไมล์",
          en: "Every part at the mechanic price · no car or mileage needed",
        })}
      </Note>
    </>
  );
}

function CustomerCards() {
  const { t } = useLang();
  const pos = usePos();
  const { bill, lookup, tried, missing } = pos;
  const err = (m: "plate" | "car" | "mileage", text: { th: string; en: string }) =>
    tried && missing.includes(m) ? t(text) : null;
  const plateDone = lookup.status === "done" || lookup.status === "error";
  const known = lookup.status === "done" && lookup.summary?.known === true;
  const last = lookup.summary?.lastMileage ?? null;
  const mileageHint = last
    ? t({
        th: `ล่าสุด ${last.km.toLocaleString("en-US")} km · ${shortDay(last.at)}`,
        en: `Last ${last.km.toLocaleString("en-US")} km · ${shortDay(last.at)}`,
      })
    : t({ th: "เช่น 152,300 km", en: "e.g. 152,300 km" });

  const carRows = (
    <>
      <ChoiceRow
        label={t({ th: "รถ", en: "Car" })}
        value={bill.car || t({ th: "เลือกยี่ห้อ · รุ่น · ปี", en: "Brand · model · year" })}
        onPress={() => pos.setSheet("car")}
        error={err("car", { th: "เลือกรถ", en: "Pick the car" })}
      />
      <FieldRow
        label={t({ th: "เลขไมล์", en: "Mileage" })}
        value={bill.mileage}
        placeholder={mileageHint}
        keyboardType="number-pad"
        onChange={(v) => pos.setBill((b) => ({ ...b, mileage: v }))}
        error={err("mileage", { th: "ใส่เลขไมล์", en: "Enter the mileage" })}
        last
      />
    </>
  );

  return (
    <>
      <Group>
        <FieldRow
          label={t({ th: "ทะเบียน", en: "Plate" })}
          value={bill.plate}
          placeholder={t({ th: "เช่น 1กก 1234", en: "e.g. 1กก 1234" })}
          onChange={(v) => pos.setBill((b) => ({ ...b, plate: v }))}
          onBlur={() => {
            if (bill.plate.trim() !== lookup.plate) void pos.lookupPlate(bill.plate);
          }}
          error={err("plate", { th: "ใส่ทะเบียนรถ", en: "Enter the plate" })}
        />
        <FieldRow
          label={t({ th: "จังหวัด", en: "Province" })}
          value={bill.province}
          placeholder={t({ th: "บนป้ายทะเบียน", en: "On the plate" })}
          onChange={(v) => pos.setBill((b) => ({ ...b, province: v }))}
          last
        />
      </Group>
      {!plateDone && (
        <Note>
          {lookup.status === "loading"
            ? t({ th: "กำลังหาลูกค้า…", en: "Looking up the customer…" })
            : t({
                th: "พิมพ์ทะเบียนแล้วระบบหาลูกค้าและรถให้เอง",
                en: "Type the plate and the customer and car fill in",
              })}
        </Note>
      )}
      {plateDone && known && lookup.summary && (
        <Group spaced>
          <KnownCustomer />
          {carRows}
        </Group>
      )}
      {plateDone && !known && (
        <>
          <Text style={[TYPE.subhead, styles.newLabel]}>
            {lookup.status === "error"
              ? t({ th: "หาลูกค้าเดิมไม่ได้ (ไม่มีเน็ต)", en: "Could not look up (no internet)" })
              : t({ th: "ลูกค้าใหม่", en: "New customer" })}
          </Text>
          <Group>
            <FieldRow
              label={t({ th: "ชื่อ", en: "Name" })}
              value={bill.customerName}
              placeholder={t({ th: "ไม่บังคับ", en: "Optional" })}
              onChange={(v) => pos.setBill((b) => ({ ...b, customerName: v }))}
            />
            <PhoneRows />
            {carRows}
          </Group>
          <Note>
            {t({
              th: "บันทึกเข้าสมุดลูกค้าตอนออกบิล พร้อมเลขไมล์และวันที่ · ครั้งหน้าพิมพ์ทะเบียนก็ขึ้นเอง",
              en: "Saved to customers when the bill is issued, with the mileage and date",
            })}
          </Note>
        </>
      )}
    </>
  );
}

function PhoneRows() {
  const { t } = useLang();
  const pos = usePos();
  const phones = pos.bill.phones.length > 0 ? pos.bill.phones : [""];
  return (
    <>
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
      />
    </>
  );
}

function KnownCustomer() {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const s = pos.lookup.summary;
  if (!s) return null;
  const name = pos.bill.customerName || t({ th: "ไม่มีชื่อ", en: "No name" });
  const facts = [
    pos.bill.phones.filter(Boolean).join(", "),
    t({ th: `มาแล้ว ${s.visits} ครั้ง`, en: `${s.visits} visits` }),
    s.lastVisitAt
      ? t({ th: `ล่าสุด ${shortDay(s.lastVisitAt)}`, en: `last ${shortDay(s.lastVisitAt)}` })
      : "",
  ].filter(Boolean);
  return (
    <Pressable
      onPress={() => pos.setSheet("customer")}
      accessibilityRole="button"
      style={[styles.known, { borderBottomColor: theme.border }]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.hover }]}>
        <Text style={[TYPE.subhead, { color: theme.text, fontWeight: "700" }]}>
          {initials((pos.bill.customerName || pos.bill.plate).replace(/^คุณ\s*/, ""))}
        </Text>
      </View>
      <View style={styles.knownText}>
        <Text style={[TYPE.headline, { color: theme.text }]}>{name}</Text>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{facts.join(" · ")}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gap: { height: SPACE.m },
  newLabel: {
    marginTop: SPACE.l,
    marginBottom: SPACE.s,
    marginHorizontal: SPACE.xs,
    fontWeight: "600",
  },
  known: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  knownText: { flex: 1, minWidth: 0 },
});
