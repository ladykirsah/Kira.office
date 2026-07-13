import { ICONS, ICON_STROKE, glyphTransform, type IconName } from "./icons/registry";

export type { IconName };

export interface IconProps {
  name: IconName;
  /** rendered box size in px (default 24); the line stays 1.5px regardless via non-scaling-stroke */
  size?: number;
  /** accessible name — when set the icon is exposed as an image; otherwise it is aria-hidden */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  /** override the shared line weight only for a deliberate one-off */
  strokeWidth?: number;
}

/**
 * The one storefront icon. Renders a hand-picked thin-line glyph from the registry, coloured by
 * `currentColor` (white on the coral header, coral/gray on white surfaces) and drawn with a single
 * constant line weight. Presentational and hook-free, so it works in both server and client
 * components. Decorative by default (aria-hidden) since call sites label the enclosing control;
 * pass `title` for a standalone icon that needs its own accessible name.
 */
export function Icon({
  name,
  size = 24,
  title,
  className,
  style,
  strokeWidth = ICON_STROKE,
}: IconProps) {
  const glyph = ICONS[name];
  const transform = glyphTransform(glyph.scale, glyph.cx, glyph.cy);
  const cls = className ? `ap-icon ${className}` : "ap-icon";
  const inner = { __html: glyph.inner };
  return (
    <svg
      className={cls}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {transform ? (
        <g transform={transform} dangerouslySetInnerHTML={inner} />
      ) : (
        <g dangerouslySetInnerHTML={inner} />
      )}
    </svg>
  );
}
