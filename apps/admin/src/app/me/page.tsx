import { redirect } from "next/navigation";
import { PageHeader } from "../PageHeader";
import { currentStaff, staffToken, STAFF_SESSION_HEADER } from "@/lib/staffSession";
import { apiFetch } from "@/lib/apiFetch";
import { MyProfile, type Profile, type MonthPay } from "./MyProfile";
import { bangkokMonth } from "@l-shopee/core";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  mechanic: "Mechanic",
};

export default async function MePage() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const token = await staffToken();
  let profile: Profile | null = null;
  try {
    const res = await apiFetch("/staff/me/profile", {
      cache: "no-store",
      headers: { [STAFF_SESSION_HEADER]: token ?? "" },
    });
    if (res.ok) profile = ((await res.json()) as { profile: Profile }).profile;
  } catch {
    profile = null;
  }

  // This month's own figures, so the Salary card can say what has been taken early and what is
  // still coming. Readable by the person themselves — see staffPayments. Degraded to null rather
  // than failing the page: a profile without a wage line is still worth showing.
  const month = bangkokMonth(Date.now());
  let thisMonth: MonthPay | null = null;
  try {
    const res = await apiFetch(`/staff/${staff.userId}/payments?month=${month}`, {
      cache: "no-store",
      headers: { [STAFF_SESSION_HEADER]: token ?? "" },
    });
    if (res.ok) {
      const { payments } = (await res.json()) as { payments: MonthPay[] };
      thisMonth = payments.find((p) => p.period === month) ?? null;
    }
  } catch {
    thisMonth = null;
  }

  return (
    <main>
      <PageHeader
        title="My profile"
        subtitle={`${profile?.nameTh || staff.name} · ${ROLE_LABEL[staff.role] ?? staff.role}`}
      />
      {profile ? (
        <MyProfile profile={profile} thisMonth={thisMonth} />
      ) : (
        <div className="empty">
          <div className="empty-icon" aria-hidden>
            ⚠
          </div>
          <span style={{ color: "var(--danger)" }}>
            Couldn&rsquo;t load your profile. Try again in a moment.
          </span>
        </div>
      )}
    </main>
  );
}
