import { router } from "expo-router";
import { Text } from "react-native";
import { accountName, carLine, plateLine, rowDate } from "@/lib/customerPage";
import type { AccountRow, CarRow } from "@/lib/customersApi";
import { useLang, useTheme } from "../AppProviders";
import { DeskCard } from "../desk/DeskCard";
import { Table, type TableColumn } from "../desk/Table";
import { TYPE } from "../theme";

const openCar = (c: CarRow) =>
  router.push(`/customers/${encodeURIComponent(c.licensePlate)}` as never);
const openAccount = (a: AccountRow) =>
  router.push(`/customers/airplus/${encodeURIComponent(a.id)}` as never);

/**
 * เด่นแอร์'s cars on a computer (DeskCustomers board, 4 Nov 2026): one row per car — the plate with
 * its province, the car, the last visit — and the whole row opens the car's page.
 */
export function CarsTable({ title, cars, now }: { title: string; cars: CarRow[]; now: number }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const columns: TableColumn<CarRow>[] = [
    {
      key: "plate",
      label: t({ th: "ทะเบียน", en: "Plate" }),
      cell: (c) => (
        <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={1}>
          {plateLine(c.licensePlate, c.plateProvince)}
        </Text>
      ),
    },
    {
      key: "car",
      label: t({ th: "รถ", en: "Car" }),
      width: 260,
      cell: (c) => (
        <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
          {carLine(c)}
        </Text>
      ),
    },
    {
      key: "last",
      label: t({ th: "ล่าสุด", en: "Last" }),
      width: 120,
      align: "right",
      cell: (c) => (
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {t(rowDate(c.lastVisitAt, now))}
        </Text>
      ),
    },
  ];
  return (
    <DeskCard title={title} pad={4}>
      <Table
        columns={columns}
        rows={cars}
        rowKey={(c) => c.licensePlate}
        onPress={openCar}
        rowLabel={(c) => plateLine(c.licensePlate, c.plateProvince)}
        minRowHeight={52}
      />
    </DeskCard>
  );
}

/** AirPlus accounts on a computer: the name (or why there is none), the code, the last order. */
export function AccountsTable({
  title,
  accounts,
  now,
}: {
  title: string;
  accounts: AccountRow[];
  now: number;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const columns: TableColumn<AccountRow>[] = [
    {
      key: "name",
      label: t({ th: "ชื่อ", en: "Name" }),
      cell: (a) => (
        <Text
          style={[
            TYPE.headline,
            { color: a.anonymizedAt !== null || !a.name?.trim() ? theme.textMuted : theme.text },
          ]}
          numberOfLines={1}
        >
          {t(accountName(a))}
        </Text>
      ),
    },
    {
      key: "code",
      label: t({ th: "รหัส", en: "Code" }),
      width: 260,
      cell: (a) => (
        <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
          {a.customerCode ?? "—"}
        </Text>
      ),
    },
    {
      key: "last",
      label: t({ th: "ล่าสุด", en: "Last" }),
      width: 120,
      align: "right",
      cell: (a) => (
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {t(rowDate(a.lastOrderAt, now))}
        </Text>
      ),
    },
  ];
  return (
    <DeskCard title={title} pad={4}>
      <Table
        columns={columns}
        rows={accounts}
        rowKey={(a) => a.id}
        onPress={openAccount}
        rowLabel={(a) => t(accountName(a))}
        minRowHeight={52}
      />
    </DeskCard>
  );
}
