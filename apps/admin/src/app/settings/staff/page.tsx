import { redirect } from "next/navigation";
import { PageHeader } from "../../PageHeader";
import { currentStaff, staffToken, STAFF_SESSION_HEADER } from "@/lib/staffSession";
import { apiFetch } from "@/lib/apiFetch";
import { StaffTabs } from "./StaffTabs";
import { PeopleTable, type StaffRow } from "./PeopleTable";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const me = await currentStaff();
  if (!me) redirect("/login");
  // Belt and braces: the menu already hides this from everyone else, and the API refuses them
  // anyway. This just turns a 403-shaped empty page into an honest redirect.
  if (me.role !== "super_admin") redirect("/");

  const token = await staffToken();
  let staff: StaffRow[] = [];
  let error: string | null = null;
  try {
    const res = await apiFetch("/staff", {
      cache: "no-store",
      headers: { [STAFF_SESSION_HEADER]: token ?? "" },
    });
    if (res.ok) staff = ((await res.json()) as { staff: StaffRow[] }).staff;
    else error = `Couldn't load the staff list (HTTP ${res.status})`;
  } catch (e) {
    error = (e as Error).message || "Couldn't reach the server.";
  }

  return (
    <main>
      <PageHeader title="Staff" subtitle="Who can open Kira.office, and what they can reach." />
      {/* PeopleTable draws its own tab row, because Add person sits on it and needs the table's
          state. The error path has no button, so it draws the plain tabs. */}
      {error ? (
        <>
          <StaffTabs active="people" />
          <div className="empty">
            <div className="empty-icon" aria-hidden>
              ⚠
            </div>
            <span style={{ color: "var(--danger)" }}>{error}</span>
          </div>
        </>
      ) : (
        <PeopleTable staff={staff} meId={me.userId} />
      )}
    </main>
  );
}
