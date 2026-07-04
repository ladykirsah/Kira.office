import type { CSSProperties, ReactNode } from "react";

/** Text-style back link (no fill/border), used under a PageHeader title via its `below` slot. */
const style: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  minHeight: 0,
  width: "fit-content",
  color: "var(--primary)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  textAlign: "left",
  textDecoration: "none",
};

/**
 * The canonical "go back" affordance: an arrow + label as a text button. Pass `href` for route
 * navigation (renders an <a>) or `onClick` for an in-page change (renders a <button>).
 */
export function BackLink({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const content = <>← {children}</>;
  if (href) {
    return (
      <a href={href} style={style}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} style={style}>
      {content}
    </button>
  );
}
