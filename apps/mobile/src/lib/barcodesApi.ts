import { failure, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * What ออกบาร์โค้ด reads from the server besides the catalogue: the shop name and phone printed
 * beside every label's QR, set on ข้อมูลร้าน (เด่นแอร์). An empty phone leaves its line out.
 */
export async function readLabelShop(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<{ name: string; phone: string }> {
  const res = await fetchFn(`${base}/shop-info/denair`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Shop details failed to load");
  const body = (await res.json()) as { name?: string | null; phone?: string | null };
  return { name: (body.name ?? "").trim(), phone: (body.phone ?? "").trim() };
}
