import { useLocalSearchParams } from "expo-router";
import { OWN_PAY_ROUTE, PROFILE_ROUTE, ownPayMonthRoute } from "@/lib/profilePage";
import { useAuth, useLang } from "../AppProviders";
import { PayHistory, PayRecord } from "../staff/PayScreens";
import { asMember, useOwnProfile } from "./useOwnProfile";

function useMe() {
  const auth = useAuth();
  const me = useOwnProfile();
  return {
    id: auth.status === "signed-in" ? auth.staff.userId : "",
    person: me.profile ? asMember(me.profile) : null,
  };
}

/** ดูเงินเดือนทั้งหมด from โปรไฟล์ของฉัน: every month, read only — no pay button (canvas v335, row 2). */
export function OwnPayHistoryScreen() {
  const { t } = useLang();
  const me = useMe();
  return (
    <PayHistory
      id={me.id}
      person={me.person}
      back={{ label: t({ th: "โปรไฟล์ของฉัน", en: "My profile" }), to: PROFILE_ROUTE }}
      monthRoute={ownPayMonthRoute}
    />
  );
}

/** A paid month from โปรไฟล์ของฉัน: that month's payslip, read only. */
export function OwnPayRecordScreen() {
  const { period = "" } = useLocalSearchParams<{ period: string }>();
  const me = useMe();
  return <PayRecord id={me.id} period={period} person={me.person} backTo={OWN_PAY_ROUTE} />;
}
