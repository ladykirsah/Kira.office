/**
 * Row-action icons for the admin, matching the existing `.icon-btn` set (Edit/Delete in the Services
 * table): 16px, 24×24 viewBox, stroke 2, round caps. Add a glyph here rather than re-inlining an SVG.
 * Decorative by default (aria-hidden) — the button/link around it carries the aria-label.
 */
export type AdminIconName = "view" | "save" | "close" | "edit" | "trash";

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
      {name === "edit" && (
        <>
          {/* Pencil — the same two paths the Services table draws, so a row action looks the same
              wherever it appears. */}
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </>
      )}
      {name === "trash" && (
        <>
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>
      )}
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
