import { dayField, dayPill, parseDayField } from "@/lib/orderList";
import { useLang } from "../AppProviders";
import { PickerPill } from "./PickerPill";
import { UNSEEN_PICKER, openPicker } from "./unseenPicker";

interface DateBoxProps {
  value: number | null;
  onChange: (day: number | null) => void;
  label: string;
}

/** On the web: the day in a pill ("1 ต.ค. 2569"); a tap opens the browser's own date wheel. */
export function DateBox({ value, onChange, label }: DateBoxProps) {
  const { t } = useLang();
  return (
    <PickerPill text={t(dayPill(value))}>
      <input
        type="date"
        aria-label={label}
        value={value == null ? "" : dayField(value)}
        onChange={(e) => onChange(parseDayField(e.target.value))}
        onClick={openPicker}
        style={UNSEEN_PICKER}
      />
    </PickerPill>
  );
}
