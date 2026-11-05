/**
 * Flash-sale scarcity bar: sold vs the campaign's stock cap. No cap → no bar. "100%" is kept for a
 * genuinely used-up cap — floor + clamp so "97/100 sold" never reads 100%. Shared by the computer
 * flash rail and the phone flash card (board 1, "เหลือ N ชิ้น").
 */
export interface FlashScarcity {
  soldPct: number;
  remaining: number;
}

export function flashScarcity(
  campaign: { stockCap: number | null; soldCount: number } | null,
): FlashScarcity | null {
  const cap = campaign?.stockCap ?? null;
  if (cap === null || cap <= 0) return null;
  const sold = campaign?.soldCount ?? 0;
  const remaining = Math.max(0, cap - sold);
  const soldPct = remaining > 0 ? Math.min(99, Math.floor((sold / cap) * 100)) : 100;
  return { soldPct, remaining: Math.floor(remaining) };
}
