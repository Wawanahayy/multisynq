export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { readOrderToken } from "@/lib/order-token";
import { getSigningSecretSync } from "@/lib/signing-secret";
import { looksLikeTxId, parseAmountToBigInt, looksLikeSparkAddress, looksLikeTokenId } from "@/lib/validate";
import { verifyTxInvolves } from "@/lib/verifier";
import { rateLimit } from "@/lib/rate-limit";
import { mintThenTransfer } from "@/lib/mint-flow";
import { claimTxOnce } from "@/lib/tx-once";

function ipKey(req: NextRequest, scope: string){
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
  return `${scope}:${ip}`;
}
function envInt(name: string, def: number){
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : def;
}
function envBool(name:string, def=false){
  const s = String(process.env[name] ?? '').trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return def;
}

export async function POST(req: NextRequest) {
  // Rate limit via .env (default 1x/60s)
  const RL_LIMIT     = envInt('PAYMINT_VERIFY_RL_LIMIT', 1);
  const RL_WINDOW_MS = envInt('PAYMINT_VERIFY_RL_WINDOW_MS', 60_000);
  const rl = rateLimit(ipKey(req,'paymint:verify'), RL_LIMIT, RL_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok:false, error:'rate_limited', retryAfterMs: rl.retryAfterMs ?? RL_WINDOW_MS },
      { status: 429 }
    );
  }

  // Delays via .env
  const MIN_AGE_MS = envInt('PAYMINT_MIN_VERIFY_DELAY_MS', 0);  // ⬅ default 0 biar gak "too_early"
  const MAP_PENDING_TO_TOO_EARLY = envBool('PAYMINT_MAP_PENDING_TO_TOO_EARLY', false);

  try {
    const body = await req.json().catch(()=> ({}));
    const token = String(body?.token || '').trim();
    const payer = String(body?.payerSparkAddress || '').trim() || undefined;
    const txId  = body?.txId ? String(body.txId).trim() : undefined;

    if (!token) return NextResponse.json({ ok:false, error:'missing token' }, { status:400 });
    if (!txId)  return NextResponse.json({ ok:false, error:'tx_required' }, { status:400 });
    if (!looksLikeTxId(txId)) return NextResponse.json({ ok:false, error:'bad txId format' }, { status:400 });

    const secret = getSigningSecretSync();

    // ⛔ Secret issuer wajib
    const hasMnemonic = (process.env.ISSUER_MNEMONIC ?? '').trim().length > 0;
    const hasSeedHex  = (process.env.ISSUER_SEED_HEX ?? '').trim().length > 0;
    if (!hasMnemonic && !hasSeedHex) {
      return NextResponse.json({ ok:false, error:'issuer_secret_missing' }, { status: 500 });
    }

    const payload = readOrderToken(token, secret);

    const feeAddress = String(payload.feeAddress || '');
    const receiver  = String(payload.receiver || '');
    const amountBI  = parseAmountToBigInt(String(payload.amount || '0'));

    if (!looksLikeSparkAddress(feeAddress) || !looksLikeSparkAddress(receiver) || amountBI <= 0n) {
      return NextResponse.json({ ok:false, error:'bad_payload' }, { status:400 });
    }

    // Jeda minimal (untuk indexer), configurable dari .env
    const age = Date.now() - Number(payload.since || 0);
    if (age < MIN_AGE_MS) {
      return NextResponse.json({ ok:false, error:'too_early', retryAfterMs: Math.max(0, MIN_AGE_MS - age) }, { status: 425 });
    }

    // Verifikasi pembayaran
    const res = await verifyTxInvolves(txId, feeAddress, { payer, amount: amountBI });
    if (!res.ok) {
      const reason = String(res.reason || '');
      // Default: JANGAN map ke too_early → kembalikan alasan asli (mis. bad_status(sent))
      if (MAP_PENDING_TO_TOO_EARLY && /bad_status\((sent|pending|processing)\)/i.test(reason)) {
        const retryMs = envInt('PAYMINT_PENDING_RETRY_MS', 60_000);
        return NextResponse.json({ ok:false, error:'too_early', source: res.source || null, retryAfterMs: retryMs }, { status: 425 });
      }
      return NextResponse.json({ ok:false, error: reason || 'verify_failed', source: res.source || null }, { status: 400 });
    }

    // 1 tx = 1 mint
    const claim = claimTxOnce(txId, { receiver, feeAddress, amount: amountBI.toString() });
    if (!claim.ok) {
      return NextResponse.json({ ok:false, error:'tx_already_used' }, { status: 409 });
    }

    // ENV-only target token/amount
    const tokenId = process.env.PAYMINT_PAYOUT_TOKEN_ID || null;
    const payoutBaseStr = process.env.PAYMINT_PAYOUT_BASEUNITS || null;

    if (!tokenId || !looksLikeTokenId(tokenId)) {
      claim.release();
      return NextResponse.json({ ok:true, source: res.source || null, minted:false, reason:'tokenId_missing_or_bad' }, { status: 200 });
    }
    if (!payoutBaseStr || !/^[0-9]+$/.test(String(payoutBaseStr))) {
      claim.release();
      return NextResponse.json({ ok:true, source: res.source || null, minted:false, reason:'payoutBase_missing_or_bad' }, { status: 200 });
    }

    try {
      const amt = BigInt(String(payoutBaseStr));
      const out = await mintThenTransfer({
        tokenIdentifier: tokenId,
        tokenAmount: amt,
        receiverSparkAddress: receiver,
      });
      return NextResponse.json({
        ok:true, source: res.source || null, minted:true,
        mintTxId: out.mintTxId, transferTxId: out.transferTxId
      });
    } catch (e:any) {
      claim.release();
      return NextResponse.json({ ok:true, source: res.source || null, minted:false, errorMint:String(e?.message||e) }, { status: 200 });
    }
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:String(e?.message || e) }, { status: 500 });
  }
}
