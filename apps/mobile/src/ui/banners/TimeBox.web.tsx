import type { CSSProperties } from "react";
import { parseTimeField } from "@/lib/bannerPage";
import { useTheme } from "../AppProviders";

interface TimeBoxProps {
  /** "23:59". */
  value: string;
  onChange: (minutes: number | null, text: string) => void;
  label: string;
}

/** On the web the browser's own time box, so a phone shows its time wheel (beside the DateBox). */
export function TimeBox({ value, onChange, label }: TimeBoxProps) {
  const { theme } = useTheme();
  const style: CSSProperties = {
    width: 120,
    border: 0,
    background: "transparent",
    color: theme.text,
    font: "inherit",
    fontSize: 17,
    textAlign: "right",
    outline: "none",
  };
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(parseTimeField(e.target.value), e.target.value)}
      style={style}
    />
  );
}
