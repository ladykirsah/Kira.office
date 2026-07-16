import { Pill } from "@/components/Pill";

/**
 * "พร้อมส่ง" (ready-to-ship) status — the same pill design as the brand tag, in green. Shown next to
 * the brand tag on the product card AND the cart line. Out-of-stock products are filtered upstream
 * (they never reach a card, and only in-stock items get added to the cart), so this is always safe
 * to show; checkout re-checks stock server-side.
 */
export function ReadyToShip() {
  return (
    <Pill color="var(--ship)" background="rgba(5, 150, 105, 0.12)">
      พร้อมส่ง
    </Pill>
  );
}
