import type { CSSProperties } from "react";
import { dayField, parseDayField } from "@/lib/orderList";
import { useTheme } from "../AppProviders";

interface DateBoxProps {
  value: number | null;
  onChange: (day: number | null) => void;
  label: string;
}

/** On the web the browser's own date box, so a phone shows its date wheel. */
export function DateBox({ value, onChange, label }: DateBoxProps) {
  const { theme } = useTheme();
  const style: CSSProperties = {
    flex: 1,
    minWidth: 0,
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
      type="date"
      aria-label={label}
      value={value == null ? "" : dayField(value)}
      onChange={(e) => onChange(parseDayField(e.target.value))}
      style={style}
    />
  );
}
