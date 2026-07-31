/**
 * Row-action icons for the admin, matching the existing `.icon-btn` set (Edit/Delete in the Services
 * table): 16px, 24×24 viewBox, stroke 2, round caps. Add a glyph here rather than re-inlining an SVG.
 * Decorative by default (aria-hidden) — the button/link around it carries the aria-label.
 */
export type AdminIconName = "view" | "save" | "close";

export function Icon({ name, size = 16 }: { name: AdminIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {name === "view" && (
        <>
          {/* Expand — open the preview. */}
          <path d="M8 3H3v5" />
          <path d="M21 8V3h-5" />
          <path d="M16 21h5v-5" />
          <path d="M3 16v5h5" />
        </>
      )}
      {name === "save" && (
        <>
          {/* Tray download — keep the file. */}
          <path d="M12 3v11" />
          <path d="M8 10l4 4 4-4" />
          <path d="M4 20h16" />
        </>
      )}
      {name === "close" && <path d="M18 6 6 18M6 6l12 12" />}
    </svg>
  );
}
