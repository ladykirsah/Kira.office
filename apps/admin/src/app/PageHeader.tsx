import type { ReactNode } from "react";

/**
 * Canonical page header used on every page: title (h1) + optional subtitle, with an optional
 * right-aligned action slot (a button/link for pages that have one). Defined once so the headline /
 * subtitle design stays identical everywhere — tweak spacing here, not per page.
 *
 * `below` is an optional slot rendered inside the title block, under the subtitle — e.g. a
 * text-style back link on a detail page. Defaults to nothing, so existing pages are unaffected.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  below,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  below?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        marginBottom: 40,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        {subtitle ? (
          <p className="muted" style={{ margin: 0 }}>
            {subtitle}
          </p>
        ) : null}
        {below ?? null}
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}
