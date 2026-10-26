import Svg, { Path } from "react-native-svg";

interface LineIconProps {
  /** One SVG path on a 24-unit grid. */
  d: string;
  color: string;
  size?: number;
  strokeWidth?: number;
}

/** A thin line icon in the design guide's style. Decorative: the button around it carries the label. */
export function LineIcon({ d, color, size = 22, strokeWidth = 1.9 }: LineIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path
        d={d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
