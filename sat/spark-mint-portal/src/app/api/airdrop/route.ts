import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getIssuerWallet } from '@/lib/spark';
import { looksLikeSparkAddress, parseAmountToBigInt } from '@/lib/validate';

const Body = z.object({
  tokenIdentifier: z.string().min(20),
  toSparkAddress: z.string().min(20),
  tokenAmount: z.string().regex(/^[0-9]+$/),
});

export async function POST(req: Request) {
  try {
    const b = Body.parse(await req.json());

    if (!looksLikeSparkAddress(b.toSparkAddress)) {
      return NextResponse.json({ ok: false, error: 'invalid spark address' }, { status: 400 });
    }

    const wallet = await getIssuerWallet();
    const amount = parseAmountToBigInt(b.tokenAmount);

    const txId = await wallet.transfer({
      tokenIdentifier: b.tokenIdentifier,
      to: b.toSparkAddress,
      amount,
    });

    return NextResponse.json({
      ok: true,
      txId,
      tokenIdentifier: b.tokenIdentifier,
      to: b.toSparkAddress,
      amount: b.tokenAmount, // kirim balik sebagai string (hindari BigInt serialize error)
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 400 });
  }
}
