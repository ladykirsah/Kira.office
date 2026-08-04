import { redirect } from "next/navigation";
import { PageHeader } from "../PageHeader";
import { currentStaff, staffToken, STAFF_SESSION_HEADER } from "@/lib/staffSession";
import { apiFetch } from "@/lib/apiFetch";
import { MyProfile, type Profile } from "./MyProfile";

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

  return (
    <main>
      <PageHeader
        title="My profile"
        subtitle={`${profile?.nameTh || staff.name} · ${ROLE_LABEL[staff.role] ?? staff.role}`}
      />
      {profile ? (
        <MyProfile profile={profile} />
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
