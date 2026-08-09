import { redirect } from "next/navigation";
import { bangkokMonth } from "@l-shopee/core";
import { PageHeader } from "../../../PageHeader";
import { currentStaff, staffToken, STAFF_SESSION_HEADER } from "@/lib/staffSession";
import { apiFetch } from "@/lib/apiFetch";
import { StaffTabs } from "../StaffTabs";
import { TeamDaysOff, type TeamPerson } from "./TeamDaysOff";
import type { DayOffRow } from "../../../DayOffTable";

/**
 * Staff → วันหยุด. Who is off this month, and the place to record a day for somebody who forgot.
 *
 * Super admin only, and not merely by menu: the reason field is free text and someone will write
 * why they were at a hospital in it. `listTeamDaysOff` refuses anyone else on the API side too —
 * a page nobody can see is not a permission.
 */
export const dynamic = "force-dynamic";

export default async function DaysOffPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/login");
  if (me.role !== "super_admin") redirect("/");

  const month = (await searchParams).month || bangkokMonth(Date.now());
  const token = await staffToken();
  const headers = { [STAFF_SESSION_HEADER]: token ?? "" };

  let days: DayOffRow[] = [];
  let people: TeamPerson[] = [];
  let error: string | null = null;
  try {
    const [d, p] = await Promise.all([
      apiFetch(`/staff/days-off?month=${encodeURIComponent(month)}`, {
        cache: "no-store",
        headers,
      }),
      apiFetch(`/staff`, { cache: "no-store", headers }),
    ]);
    if (d.ok) days = ((await d.json()) as { days: DayOffRow[] }).days;
    if (p.ok) people = ((await p.json()) as { staff: TeamPerson[] }).staff ?? [];
  } catch {
    error = "ยังโหลดข้อมูลไม่ได้ ลองใหม่อีกครั้ง";
  }

  return (
    <>
      <PageHeader title="Staff" subtitle="วันหยุดของทีม — ใครหยุดวันไหนบ้าง" />
      <StaffTabs active="days-off" />
      {error ? (
        <p className="muted">{error}</p>
      ) : (
        <TeamDaysOff month={month} days={days} people={people} />
      )}
    </>
  );
}
