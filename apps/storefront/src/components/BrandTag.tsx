import { Pill } from "@/components/Pill";

/**
 * Gray brand pill (e.g. "DENSO", "Coolgear"). Fill is a translucent tint of the text color
 * (--gray-mid @ 12%) rather than a solid color, so the chip darkens whatever surface it sits on and
 * stays visible on BOTH a white card and the paper-colored page — the same trick the green
 * ReadyToShip pill uses. Rendered identically by ProductCard, the cart line, and the PDP.
 */
export function BrandTag({ name }: { name: string }) {
  return (
    <Pill color="var(--gray-mid)" background="rgba(115, 115, 115, 0.12)">
      {name}
    </Pill>
  );
}
