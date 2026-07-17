import type { ReactNode } from "react";

/**
 * Shared renderer for the storefront's legal policy pages (privacy / terms / returns), so they share
 * one layout and stay consistent. Section bodies are rendered with `white-space: pre-wrap` — the
 * authoritative Thai text (bullets "•", numbered steps, indented sub-items) is preserved verbatim,
 * which matters for legal wording. Source of truth: docs/policies/*.md on the policy branch.
 */
export type PolicySection = { heading: string; body: string };

export function PolicyDoc({
  title,
  subtitle,
  updated,
  sections,
  note,
}: {
  title: string;
  subtitle: string;
  updated?: string;
  sections: PolicySection[];
  note?: ReactNode;
}) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="section">
        <h1 className="t-h1" style={{ margin: "0 0 4px" }}>
          {title}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {subtitle}
        </p>
        {updated && (
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12.5 }}>
            ปรับปรุงล่าสุด: {updated}
          </p>
        )}
      </div>

      <div className="card" style={{ padding: "8px 24px 24px" }}>
        {note}
        {sections.map((s) => (
          <section key={s.heading} style={{ marginTop: 24 }}>
            <h2 className="t-h3" style={{ margin: "0 0 8px" }}>
              {s.heading}
            </h2>
            <div className="t-body" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
              {s.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
