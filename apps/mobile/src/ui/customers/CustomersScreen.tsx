import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { accountName, plateLine, rowDate } from "@/lib/customerPage";
import type { AccountRow, CarRow } from "@/lib/customersApi";
import { useLang, useTheme } from "../AppProviders";
import { Group, Row, SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { SPACE, TYPE } from "../theme";
import { ImportSheet, IMPORT_ICON, useImport } from "./ImportSheet";
import { Empty, ListRow, SearchField, SummaryCard } from "./parts";
import { useCustomerList, type CustomerList } from "./useCustomerList";

/** A person with a question mark: nothing found (owner picked icon D, canvas v146). */
const NOT_FOUND_ICON =
  "M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 20v-1a5 5 0 0 1 5-5h2.5M15.6 15.2a1.9 1.9 0 1 1 2.8 1.7c-.5.3-.9.7-.9 1.3M17.5 20.6h.01";

/**
 * ลูกค้า (owner approved the drawing, canvas v151, 30 Oct 2026): หน้าร้าน cars and AirPlus accounts,
 * each with a summary card, a search box and one list. Tapping a row opens its page.
 */
export function CustomersScreen() {
  const { t } = useLang();
  const list = useCustomerList();
  const imp = useImport(list);

  useScreenChrome(
    list.side === "shop"
      ? { label: t({ th: "นำเข้า", en: "Import" }), icon: IMPORT_ICON, onPress: imp.start }
      : null,
    [],
    { toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null },
  );

  return (
    <View>
      <Subtitle list={list} />
      <View style={styles.seg}>
        <Segmented
          label={t({ th: "ลูกค้าของ", en: "Customers of" })}
          options={[
            { value: "shop", label: t({ th: "หน้าร้าน", en: "Shop" }) },
            { value: "airplus", label: "AirPlus" },
          ]}
          value={list.side}
          onChange={list.switchSide}
        />
      </View>
      {list.q.trim() === "" && list.summary && <Summary list={list} />}
      <SearchField
        value={list.q}
        onChange={list.setQ}
        placeholder={
          list.side === "shop"
            ? t({ th: "ทะเบียน รถ บิล หรือเบอร์โทร", en: "Plate, car, bill or phone" })
            : t({ th: "รหัส ชื่อ เบอร์ หรืออีเมล", en: "Code, name, phone or email" })
        }
      />
      {list.failed && (
        <View style={styles.retry}>
          <Text style={[TYPE.subhead, styles.grow]}>
            {t({ th: "โหลดรายการไม่ได้", en: "The list did not load" })}
          </Text>
          <SmallButton
            label={t({ th: "ลองอีกครั้ง", en: "Try again" })}
            onPress={() => void list.reload()}
          />
        </View>
      )}
      {list.side === "shop" ? <Cars list={list} /> : <Accounts list={list} />}
      {imp.plan && <ImportSheet imp={imp} />}
    </View>
  );
}

function Subtitle({ list }: { list: CustomerList }) {
  const { theme } = useTheme();
  const text = list.side === "shop" ? list.shopName : "AirPlus";
  if (!text) return null;
  return <Text style={[TYPE.subhead, styles.subtitle, { color: theme.textMuted }]}>{text}</Text>;
}

function Summary({ list }: { list: CustomerList }) {
  const shop = list.side === "shop";
  return (
    <SummaryCard
      summary={list.summary!}
      unit={shop ? { th: "คัน", en: "cars" } : { th: "บัญชี", en: "accounts" }}
      totalLabel={
        shop
          ? { th: "ลูกค้าทั้งหมด", en: "All customers" }
          : { th: "บัญชีทั้งหมด", en: "All accounts" }
      }
      activeLabel={
        shop
          ? { th: "มาเดือนนี้", en: "Came this month" }
          : { th: "สั่งเดือนนี้", en: "Ordered this month" }
      }
      newLabel={shop ? { th: "ใหม่", en: "New" } : { th: "สมัครใหม่", en: "Signed up" }}
      barsLabel={
        shop
          ? { th: "รถที่มาที่ร้าน 6 เดือนล่าสุด", en: "Cars at the shop, last 6 months" }
          : { th: "บัญชีที่สั่งซื้อ 6 เดือนล่าสุด", en: "Accounts that ordered, last 6 months" }
      }
    />
  );
}

/** "รถทั้งหมด", or "พบ N คัน" while searching. */
function ListHead({
  searching,
  count,
  unit,
  all,
}: {
  searching: boolean;
  count: number;
  unit: { th: string; en: string };
  all: { th: string; en: string };
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const text = searching
    ? t({ th: `พบ ${count} ${unit.th}`, en: `${count} ${unit.en} found` })
    : t(all);
  return (
    <Text style={[TYPE.title2, styles.head, { color: theme.text }]} accessibilityRole="header">
      {text}
    </Text>
  );
}

function Cars({ list }: { list: CustomerList }) {
  const { t } = useLang();
  const { theme } = useTheme();
  if (!list.cars) return null;
  const typed = list.q.trim();
  if (typed && list.cars.length === 0) {
    return (
      <Empty
        icon={NOT_FOUND_ICON}
        title={t({ th: "ไม่พบรถที่ตรงกับที่ค้นหา", en: "No car matches the search" })}
        detail={t({
          th: "รถคันใหม่จะขึ้นที่นี่เองหลังออกบิลใบแรก",
          en: "A new car shows here after its first bill",
        })}
        action={
          <Pressable
            onPress={() => router.push(`/pos?plate=${encodeURIComponent(typed)}` as never)}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text style={[TYPE.body, styles.link, { color: theme.primary }]}>
              {t({ th: `ทำบิลให้ ${typed}`, en: `Make a bill for ${typed}` })}
            </Text>
          </Pressable>
        }
      />
    );
  }
  const now = Date.now();
  return (
    <>
      <ListHead
        searching={typed !== ""}
        count={list.cars.length}
        unit={{ th: "คัน", en: "cars" }}
        all={{ th: "รถทั้งหมด", en: "All cars" }}
      />
      {list.cars.length > 0 && (
        <Group>
          {list.cars.map((c, i) => (
            <CarItem key={c.licensePlate} car={c} now={now} last={i === list.cars!.length - 1} />
          ))}
        </Group>
      )}
    </>
  );
}

function CarItem({ car, now, last }: { car: CarRow; now: number; last: boolean }) {
  const { t } = useLang();
  return (
    <ListRow
      title={plateLine(car.licensePlate, car.plateProvince)}
      right={t(rowDate(car.lastVisitAt, now))}
      sub={car.carModel?.trim() || car.vehicle?.trim() || "—"}
      last={last}
      onPress={() => router.push(`/customers/${encodeURIComponent(car.licensePlate)}` as never)}
    />
  );
}

function Accounts({ list }: { list: CustomerList }) {
  const { t } = useLang();
  const { theme } = useTheme();
  if (!list.accounts) return null;
  const typed = list.q.trim();
  const now = Date.now();
  return (
    <>
      <ListHead
        searching={typed !== ""}
        count={list.accounts.length}
        unit={{ th: "บัญชี", en: "accounts" }}
        all={{ th: "บัญชีทั้งหมด", en: "All accounts" }}
      />
      {list.accounts.length > 0 && (
        <Group>
          {list.accounts.map((a, i) => (
            <AccountItem key={a.id} account={a} now={now} last={i === list.accounts!.length - 1} />
          ))}
        </Group>
      )}
      {typed === "" && (
        <>
          <Group spaced>
            <Row
              label={t({ th: "อัปเดตเครดิตทั้งหมด", en: "Update all credit" })}
              onPress={() => void list.recalc()}
              last
            />
          </Group>
          <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>
            {t({
              th: "คำนวณเครดิตและระดับใหม่ด้วยกติกาปัจจุบัน",
              en: "Works out every credit and level again with today's rules",
            })}
          </Text>
        </>
      )}
    </>
  );
}

function AccountItem({ account, now, last }: { account: AccountRow; now: number; last: boolean }) {
  const { t } = useLang();
  return (
    <ListRow
      title={t(accountName(account))}
      right={t(rowDate(account.lastOrderAt, now))}
      sub={account.customerCode ?? "—"}
      last={last}
      onPress={() => router.push(`/customers/airplus/${encodeURIComponent(account.id)}` as never)}
    />
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: -SPACE.xs, marginHorizontal: 2 },
  seg: { marginTop: SPACE.l },
  retry: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.m },
  grow: { flex: 1 },
  head: { marginTop: SPACE.xxl, marginBottom: SPACE.m, marginHorizontal: 2 },
  link: { marginTop: SPACE.s },
  note: { marginTop: SPACE.s, marginHorizontal: SPACE.l },
});
