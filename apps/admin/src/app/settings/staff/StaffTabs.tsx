import Link from "next/link";

/**
 * People · Salary · วันหยุด · Activity — four views of the same subject, so they share one menu
 * entry rather than crowding Overall management with four (owner's placement question, 2026-08-03).
 */
const TABS = [
  { key: "people", href: "/settings/staff", label: "People" },
  { key: "salary", href: "/settings/staff/salary", label: "Salary" },
  // Beside Salary on purpose: days off are what Salary subtracts, so the two are read together.
  { key: "days-off", href: "/settings/staff/days-off", label: "วันหยุด" },
  { key: "activity", href: "/settings/staff/activity", label: "Activity" },
] as const;

export function StaffTabs({
  active,
  action,
}: {
  active: (typeof TABS)[number]["key"];
  /** The page's one primary action, placed at the right end of the tab row. */
  action?: React.ReactNode;
}) {
  const tabs = (
    <div className="staff-tabs" role="tablist" aria-label="Staff views">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={t.key === active}
          className={t.key === active ? "staff-tab on" : "staff-tab"}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
  return action ? (
    <div className="staff-tabs-row">
      {tabs}
      {action}
    </div>
  ) : (
    tabs
  );
}
