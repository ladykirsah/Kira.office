import { redirect } from "next/navigation";
import { PageHeader } from "../../../PageHeader";
import { BackLink } from "../../../BackLink";
import { currentStaff, staffToken, STAFF_SESSION_HEADER } from "@/lib/staffSession";
import { apiFetch } from "@/lib/apiFetch";
import { StaffProfileEditor, type StaffProfile } from "./StaffProfileEditor";
import { type StaffPayment } from "./PaymentsTable";

export const dynamic = "force-dynamic";

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentStaff();
  if (!me) redirect("/login");
  if (me.role !== "super_admin") redirect("/");

  const { id } = await params;
  const token = await staffToken();
  let profile: StaffProfile | null = null;
  let error: string | null = null;
  try {
    const res = await apiFetch(`/staff/${id}/profile`, {
      cache: "no-store",
      headers: { [STAFF_SESSION_HEADER]: token ?? "" },
    });
    if (res.ok) profile = ((await res.json()) as { profile: StaffProfile }).profile;
    else error = res.status === 404 ? "That person no longer exists." : `HTTP ${res.status}`;
  } catch (e) {
    error = (e as Error).message || "Couldn't reach the server.";
  }

  // Their wage history. Fetched alongside the profile rather than by the client, so the page
  // arrives complete; a failure here is not worth failing the whole profile over, so it degrades
  // to an empty list.
  let payments: StaffPayment[] = [];
  try {
    const res = await apiFetch(`/staff/${id}/payments`, {
      cache: "no-store",
      headers: { [STAFF_SESSION_HEADER]: token ?? "" },
    });
    if (res.ok) payments = ((await res.json()) as { payments: StaffPayment[] }).payments;
  } catch {
    // Leave it empty — the profile is still worth showing.
  }

  // The header moves inside the editor when there IS a profile: Edit / Cancel / Save have to sit
  // next to the form state. On the error path there is no form, so the page draws its own.
  return profile ? (
    <main>
      <StaffProfileEditor profile={profile} payments={payments} />
    </main>
  ) : (
    <main>
      <PageHeader title="Staff" below={<BackLink href="/settings/staff">Staff</BackLink>} />
      <div className="empty">
        <div className="empty-icon" aria-hidden>
          ⚠
        </div>
        <span style={{ color: "var(--danger)" }}>{error}</span>
      </div>
    </main>
  );
}
