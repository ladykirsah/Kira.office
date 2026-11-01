import { parseTimeField } from "@/lib/bannerPage";
import { PickerPill } from "../orders/PickerPill";
import { UNSEEN_PICKER, openPicker } from "../orders/unseenPicker";

interface TimeBoxProps {
  /** "23:59". */
  value: string;
  onChange: (minutes: number | null, text: string) => void;
  label: string;
}

/** On the web: the time in a pill ("00:00", as drawn); a tap opens the browser's own time wheel. */
export function TimeBox({ value, onChange, label }: TimeBoxProps) {
  return (
    <PickerPill text={value || "—"}>
      <input
        type="time"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(parseTimeField(e.target.value), e.target.value)}
        onClick={openPicker}
        style={UNSEEN_PICKER}
      />
    </PickerPill>
  );
}
