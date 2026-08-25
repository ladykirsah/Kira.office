import { redirect } from "next/navigation";
import { PageHeader } from "../PageHeader";
import { currentStaff, staffToken, STAFF_SESSION_HEADER } from "@/lib/staffSession";
import { apiFetch } from "@/lib/apiFetch";
import { MyProfile, type Profile } from "./MyProfile";
import { type StaffPayment } from "../settings/staff/[id]/PaymentsTable";
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

  // Their WHOLE wage history, not just this month (owner, 2026-08-25): this page now carries the
  // same ledger the owner's HRM view does, and the ledger's month picker filters a list it already
  // holds. Readable by the person themselves — see staffPayments, which allows self and nobody
  // else. Degraded to an empty list rather than failing the page: a profile without a wage table is
  // still worth showing.
  const month = bangkokMonth(Date.now());
  let payments: StaffPayment[] = [];
  try {
    const res = await apiFetch(`/staff/${staff.userId}/payments?month=${month}`, {
      cache: "no-store",
      headers: { [STAFF_SESSION_HEADER]: token ?? "" },
    });
    if (res.ok) payments = ((await res.json()) as { payments: StaffPayment[] }).payments;
  } catch {
    // Leave it empty — the rest of the page is still worth showing.
  }

  return (
    <main>
      <PageHeader
        title="My profile"
        subtitle={`${profile?.nameTh || staff.name} · ${ROLE_LABEL[staff.role] ?? staff.role}`}
      />
      {profile ? (
        <MyProfile profile={profile} payments={payments} month={month} />
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
