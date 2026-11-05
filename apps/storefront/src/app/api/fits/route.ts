import { NextResponse } from "next/server";
import { getDb, listCatalog } from "@/lib/db";
import { parseFitsParams } from "@/lib/myCar";

/**
 * GET /api/fits?carBrand=Toyota&carModel=Vigo[&year=2012] — the products that fit the shopper's
 * รถของฉัน (board 1). Read-only and public (catalogue data only). Returns the count, every fitting
 * variant id (so any card can say "ใส่ได้กับ …"), and the items for the "ใส่ได้กับ … ของคุณ" grid
 * and the อะไหล่ที่ใส่ได้ page.
 */
export async function GET(req: Request) {
  const params = parseFitsParams(new URL(req.url).searchParams);
  if (!params) {
    return NextResponse.json({ error: "ข้อมูลรถไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    const db = await getDb();
    const items = await listCatalog(db, { ...params, limit: 100 });
    return NextResponse.json(
      { count: items.length, ids: items.map((i) => i.variantId), items },
      { headers: { "cache-control": "public, max-age=60" } },
    );
  } catch (err) {
    console.error("[api/fits] failed", err);
    return NextResponse.json({ error: "โหลดไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
