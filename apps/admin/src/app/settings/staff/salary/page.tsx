import { redirect } from "next/navigation";
import { PageHeader } from "../../../PageHeader";
import { currentStaff, staffToken, STAFF_SESSION_HEADER } from "@/lib/staffSession";
import { apiFetch } from "@/lib/apiFetch";
import { StaffTabs } from "../StaffTabs";
import { serverT } from "@/lib/serverLang";
import { SalaryTable, type SalaryRow } from "./SalaryTable";

export const dynamic = "force-dynamic";

/** 'YYYY-MM' for right now, in Thai time — the month the owner is standing in. */
function currentPeriod(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // Asia/Bangkok
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function SalaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/login");
  if (me.role !== "super_admin") redirect("/");

  // Opens on the month you're in (owner's choice) — its figures keep moving until the month ends.
  const period = (await searchParams).month || currentPeriod();
  const t = await serverT();
  const token = await staffToken();

  let rows: SalaryRow[] = [];
  let daysInMonth = 0;
  let error: string | null = null;
  try {
    const res = await apiFetch(`/staff/salary?month=${encodeURIComponent(period)}`, {
      cache: "no-store",
      headers: { [STAFF_SESSION_HEADER]: token ?? "" },
    });
    if (res.ok) {
      const body = (await res.json()) as { rows: SalaryRow[]; daysInMonth: number };
      rows = body.rows;
      daysInMonth = body.daysInMonth;
    } else {
      error = t({
        th: `โหลดรอบจ่ายเงินเดือนไม่ได้ (HTTP ${res.status})`,
        en: `Couldn't load the salary run (HTTP ${res.status})`,
      });
    }
  } catch (e) {
    error =
      (e as Error).message ||
      t({ th: "ติดต่อเซิร์ฟเวอร์ไม่ได้", en: "Couldn't reach the server." });
  }

  return (
    <main>
      <PageHeader
        title={t({ th: "พนักงาน", en: "Staff" })}
        subtitle={t({
          th: "ใครเปิด Kira.office ได้บ้าง และเปิดถึงไหน",
          en: "Who can open Kira.office, and what they can reach.",
        })}
      />
      <StaffTabs active="salary" />
      {error ? (
        <div className="empty">
          <div className="empty-icon" aria-hidden>
            ⚠
          </div>
          <span style={{ color: "var(--danger)" }}>{error}</span>
        </div>
      ) : (
        <SalaryTable rows={rows} period={period} daysInMonth={daysInMonth} />
      )}
    </main>
  );
}
