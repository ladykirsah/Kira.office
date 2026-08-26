import { redirect } from "next/navigation";
import { PageHeader } from "../../../PageHeader";
import { currentStaff, staffToken, STAFF_SESSION_HEADER } from "@/lib/staffSession";
import { apiFetch } from "@/lib/apiFetch";
import { StaffTabs } from "../StaffTabs";
import { ActivityView, type ActivityRow } from "./ActivityView";
import { serverT, serverLang } from "@/lib/serverLang";
import type { Lang } from "@/lib/lang";

export const dynamic = "force-dynamic";

function currentPeriod(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // Asia/Bangkok
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The last twelve months, newest first — enough to answer "what happened back then". */
function monthOptions(lang: Lang): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    });
  }
  return out;
}

export default async function StaffActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; month?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/login");
  if (me.role !== "super_admin") redirect("/");

  const params = await searchParams;
  const person = params.person ?? "";
  const month = params.month || currentPeriod();
  const t = await serverT();
  const token = await staffToken();
  const headers = { [STAFF_SESSION_HEADER]: token ?? "" };

  let activity: ActivityRow[] = [];
  let people: { id: string; name: string }[] = [];
  let error: string | null = null;
  try {
    const qs = new URLSearchParams({ month });
    if (person) qs.set("person", person);
    const [actRes, staffRes] = await Promise.all([
      apiFetch(`/staff/activity?${qs}`, { cache: "no-store", headers }),
      apiFetch("/staff", { cache: "no-store", headers }),
    ]);
    if (actRes.ok) activity = ((await actRes.json()) as { activity: ActivityRow[] }).activity;
    else
      error = t({
        th: `โหลดประวัติการทำงานไม่ได้ (HTTP ${actRes.status})`,
        en: `Couldn't load the activity log (HTTP ${actRes.status})`,
      });
    if (staffRes.ok) {
      people = ((await staffRes.json()) as { staff: { id: string; name: string }[] }).staff;
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
      <StaffTabs active="activity" />
      {error ? (
        <div className="empty">
          <div className="empty-icon" aria-hidden>
            ⚠
          </div>
          <span style={{ color: "var(--danger)" }}>{error}</span>
        </div>
      ) : (
        <ActivityView
          activity={activity}
          people={people}
          person={person}
          month={month}
          months={monthOptions(await serverLang())}
        />
      )}
    </main>
  );
}
