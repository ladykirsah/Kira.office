import { computeSaleProfit, type SaleLineInput } from "@l-shopee/core";

// Bindings are added here as resources are provisioned (D1 `DB`, `STOCK_LEDGER` DO, `R2`, `KV`,
// `SHOPEE_QUEUE`, secrets). See docs/CLOUDFLARE_ARCHITECTURE.md.
export interface Env {}

/**
 * Minimal api Worker. A thin HTTP shell over @l-shopee/core; business math lives in core, not here.
 * Grows into Hono routing + the /sync endpoint + Shopee adapter as the project advances.
 */
const worker = {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "kiraoffice-api" });
    }

    // Profit preview — proves the core is wired end-to-end.
    if (url.pathname === "/pricing/preview" && request.method === "POST") {
      const line = (await request.json()) as SaleLineInput;
      return Response.json(computeSaleProfit(line));
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export default worker;
