import Svg, { Path, Rect } from "react-native-svg";

/** A QR grid (from lib/qr) drawn crisp: one path of 1×1 squares with a 2-square quiet zone. */
export function QrView({ grid, size, label }: { grid: boolean[][]; size: number; label: string }) {
  const n = grid.length;
  const box = n + 4;
  const d = grid
    .flatMap((row, r) => row.map((dark, c) => (dark ? `M${c + 2} ${r + 2}h1v1h-1z` : "")))
    .join("");
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      accessibilityLabel={label}
      role="img"
    >
      <Rect width={box} height={box} fill="#FFFFFF" />
      <Path d={d} fill="#000000" />
    </Svg>
  );
}
