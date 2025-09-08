export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { looksLikeSparkAddress, looksLikeTokenId, parseAmountToBigInt } from "@/lib/validate";
import { makeOrderToken, OrderPayload } from "@/lib/order-token";
import { getSigningSecretSync } from "@/lib/signing-secret";
import { rateLimit } from "@/lib/rate-limit";

function ipKey(req: NextRequest, scope: string){
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
  return `${scope}:${ip}`;
}
function parseIntSafe(v: string | undefined, dflt: number){
  const n = Number.parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : dflt;
}
function pickSuffixBigInt(): bigint {
  let sMin = parseIntSafe(process.env.PAYMINT_SUFFIX_MIN, 0);
  let sMax = parseIntSafe(process.env.PAYMINT_SUFFIX_MAX, 9);
  if (sMin < 0) sMin = 0;
  if (sMax < 0) sMax = 0;
  if (sMin > sMax) { const t = sMin; sMin = sMax; sMax = t; }
  const span = (sMax - sMin + 1);
  const add = span > 0 ? (sMin + Math.floor(Math.random() * span)) : sMin;
  return BigInt(add);
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(ipKey(req,'paymint:request'), 20, 10_000);
  if (!rl.ok) return NextResponse.json({ ok:false, error:'rate_limited', retryAfterMs: rl.retryAfterMs }, { status: 429 });

  try {
    const body = await req.json().catch(()=> ({}));
    const receiverSparkAddress = String(body?.receiverSparkAddress || '').trim();
    if (!looksLikeSparkAddress(receiverSparkAddress)) {
      return NextResponse.json({ ok:false, error:'bad_receiver' }, { status: 400 });
    }

    const feeAddress = String(process.env.PAYMINT_FEE_ADDRESS || '').trim();
    if (!looksLikeSparkAddress(feeAddress)) {
      return NextResponse.json({ ok:false, error:'merchant_feeAddress_not_set' }, { status: 500 });
    }

    const baseStr = String(process.env.PAYMINT_BASE_AMOUNT_SATS || '3');
    const base = parseAmountToBigInt(baseStr);
    const amount = base + pickSuffixBigInt();
    const since = Date.now();

    // ==== payout selection (env default + optional override) ====
    let tokenId: string | null =
      (process.env.PAYMINT_PAYOUT_TOKEN_ID ? String(process.env.PAYMINT_PAYOUT_TOKEN_ID) : null);
    let payoutBase: string | null =
      (process.env.PAYMINT_PAYOUT_BASEUNITS ? String(process.env.PAYMINT_PAYOUT_BASEUNITS) : null);

    // override (opsional)
    if (body?.tokenId && looksLikeTokenId(String(body.tokenId))) tokenId = String(body.tokenId);
    if (body?.payoutBase && /^[0-9]+$/.test(String(body.payoutBase))) payoutBase = String(body.payoutBase);

    const payload: OrderPayload = {
      feeAddress,
      amount: amount.toString(),
      since,
      receiver: receiverSparkAddress,
      tokenId,
      payoutBase
    };

    const token = makeOrderToken(payload, getSigningSecretSync());

    return NextResponse.json({
      ok: true,
      feeAddress,
      amount: payload.amount,
      since,
      receiver: receiverSparkAddress,
      tokenId,
      payoutBase,
      orderToken: token
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:String(e?.message || e) }, { status: 500 });
  }
}
