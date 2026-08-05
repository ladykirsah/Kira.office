"use client";

import { useRouter } from "next/navigation";
import { inputS } from "@/lib/inputStyles";

export interface ActivityRow {
  id: string;
  userId: string;
  name: string;
  role: "super_admin" | "admin" | "mechanic";
  kind: string;
  detail: string | null;
  createdAt: number;
}

const ROLE_LABEL: Record<ActivityRow["role"], string> = {
  super_admin: "Super admin",
  admin: "Admin",
  mechanic: "Mechanic",
};

/** What each kind of event says, and the colour of its dot. Red is the one you look for. */
const KIND: Record<string, { text: (d: string | null) => string; colour: string }> = {
  password_changed: { text: () => "Changed their password", colour: "var(--text-muted)" },
  pin_changed: { text: () => "Changed their PIN", colour: "var(--text-muted)" },
  day_off: { text: (d) => `Recorded a day off — ${d ?? ""}`, colour: "var(--ok)" },
  day_off_edit: { text: (d) => `Edited a day off — ${d ?? ""}`, colour: "var(--text-muted)" },
  // Coral, not grey: a deleted day off is the one day-off action that puts a day's wage back, and
  // it is the only one staff cannot do themselves. Worth being able to find in the list.
  day_off_delete: { text: (d) => `Deleted a day off — ${d ?? ""}`, colour: "var(--primary)" },
  locked: { text: (d) => `3 failed sign-ins — locked ${d ?? ""}`, colour: "var(--danger)" },
  salary_paid: { text: (d) => `Marked salary paid — ${d ?? ""}`, colour: "var(--primary)" },
  profile_edited: { text: (d) => d ?? "Updated their profile", colour: "var(--text-muted)" },
};

function describe(row: ActivityRow): { text: string; colour: string } {
  const k = KIND[row.kind];
  return k
    ? { text: k.text(row.detail), colour: k.colour }
    : { text: row.detail ?? row.kind, colour: "var(--text-muted)" };
}

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Today / Yesterday / the date — the heading each run of rows sits under. */
function dayHeading(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return `Today · ${d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString())
    return `Yesterday · ${d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function ActivityView({
  activity,
  people,
  person,
  month,
  months,
}: {
  activity: ActivityRow[];
  people: { id: string; name: string }[];
  person: string;
  month: string;
  months: { value: string; label: string }[];
}) {
  const router = useRouter();

  function go(next: { person?: string; month?: string }) {
    const p = next.person ?? person;
    const m = next.month ?? month;
    const qs = new URLSearchParams();
    if (p) qs.set("person", p);
    if (m) qs.set("month", m);
    router.push(`/settings/staff/activity${qs.toString() ? `?${qs}` : ""}`);
  }

  // Group into days as we go — the rows arrive newest first, so runs are already contiguous.
  const groups: { heading: string; rows: ActivityRow[] }[] = [];
  for (const row of activity) {
    const heading = dayHeading(row.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.rows.push(row);
    else groups.push({ heading, rows: [row] });
  }

  // The locked list-table pattern (docs/DESIGN_SYSTEM.md): one framed section holds the toolbar
  // and the table — including when the table is empty, so the filters that emptied it stay put.
  // Toolbar controls are S-size; an unset filter reads faint, a set one reads solid.
  return (
    <section className="card">
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 2px", fontSize: 16 }}>Activity</h2>
        {/* Month and count, the same shape the วันหยุด card uses — so a reader moving between the
            Staff tabs meets one heading pattern rather than a different one per tab. */}
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          {months.find((m) => m.value === month)?.label ?? month} ·{" "}
          {activity.length === 0
            ? "no changes"
            : `${activity.length} change${activity.length === 1 ? "" : "s"}`}
          {person ? ` · ${people.find((p) => p.id === person)?.name ?? ""}` : ""}
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <select
          value={person}
          onChange={(e) => go({ person: e.target.value })}
          aria-label="Filter by person"
          style={{
            ...inputS,
            color: person ? "var(--text)" : "var(--text-faint)",
            fontWeight: person ? 500 : 400,
          }}
        >
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => go({ month: e.target.value })}
          aria-label="Filter by month"
          style={inputS}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {activity.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" aria-hidden>
            🕓
          </div>
          {person ? "Nothing recorded for them this month." : "Nothing recorded for this month."}
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.heading}>
              <div className="activity-day">{g.heading}</div>
              <div className="products-scroll">
                <table className="products-table">
                  <tbody>
                    {g.rows.map((row) => {
                      const d = describe(row);
                      return (
                        <tr key={row.id}>
                          <td className="muted num" style={{ width: 78 }}>
                            {time(row.createdAt)}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {row.name} <span className="muted">· {ROLE_LABEL[row.role]}</span>
                          </td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span
                                aria-hidden
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: "50%",
                                  background: d.colour,
                                  flex: "0 0 auto",
                                }}
                              />
                              {d.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
