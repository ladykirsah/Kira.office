import { Pill } from "@/components/Pill";
import { sizeLabel } from "@/lib/sizePicker";

/**
 * Grey size pill — "ขนาด 1/2 กลาง" (board 3b, 11 Nov 2026). Grey = a product detail, so it is the
 * same translucent grey as BrandTag: it reads on a white card and on the grey page alike. Used under
 * the name on cart, checkout and order lines, and under the price on a flash card.
 */
export function SizeTag({ value, optionName }: { value: string; optionName?: string | null }) {
  return (
    <Pill color="var(--gray-mid)" background="rgba(115, 115, 115, 0.12)">
      {sizeLabel(value, optionName)}
    </Pill>
  );
}
