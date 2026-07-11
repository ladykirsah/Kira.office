/**
 * SlipOK adapter — the ONLY place that knows the provider's wire format, so a provider change (or
 * an endpoint fix) touches one function. Pure/framework-free: callers (apps/api, apps/storefront)
 * supply their own D1 orchestration around these; this module does no D1 access itself.
 */

export interface SlipOkEnv {
  SLIPOK_API_KEY?: string;
  SLIPOK_BRANCH_ID?: string;
}

/** Both SlipOK credentials present? (Unset = the feature stays manual-approve only.) */
export function slipVerificationConfigured(env: SlipOkEnv): boolean {
  return Boolean(env.SLIPOK_API_KEY && env.SLIPOK_BRANCH_ID);
}

/** Sanity check for a scanned slip mini-QR payload (bank slips carry a machine-readable QR). */
export function looksLikeSlipQr(data: string): boolean {
  const t = data.trim();
  return t.length >= 20 && t.length <= 1000 && !/\s/.test(t);
}

export type SlipVerifyResult =
  { ok: true; ref: string; note: string } | { ok: false; code: 422 | 502; error: string };

/**
 * ASSUMPTION (unverified against the live API): POST api.slipok.com/api/line/apikey/{branchId}
 * with x-authorization header, body {data, amount(THB)}; response {success, data:{transRef, amount}}.
 */
export async function verifySlipWithSlipOk(
  env: SlipOkEnv,
  qrData: string,
  expectedAmountSatang: number,
): Promise<SlipVerifyResult> {
  let res: Response;
  try {
    res = await fetch(`https://api.slipok.com/api/line/apikey/${env.SLIPOK_BRANCH_ID}`, {
      method: "POST",
      headers: { "x-authorization": env.SLIPOK_API_KEY!, "content-type": "application/json" },
      body: JSON.stringify({ data: qrData, amount: expectedAmountSatang / 100 }),
    });
  } catch {
    return { ok: false, code: 502, error: "slip verification service unreachable" };
  }
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: { transRef?: string; amount?: number };
  } | null;
  if (!body?.success || !body.data?.transRef) {
    return { ok: false, code: 422, error: body?.message ?? "slip rejected by verifier" };
  }
  // Trust but verify: if the provider echoes the slip amount, it must match the payment.
  if (
    typeof body.data.amount === "number" &&
    Math.round(body.data.amount * 100) !== expectedAmountSatang
  ) {
    return {
      ok: false,
      code: 422,
      error: `slip amount ฿${body.data.amount} does not match the payment amount`,
    };
  }
  return { ok: true, ref: body.data.transRef, note: JSON.stringify({ amount: body.data.amount }) };
}
