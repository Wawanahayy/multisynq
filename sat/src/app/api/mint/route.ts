import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getIssuerWallet } from '@/lib/spark';
import { rateLimit } from '@/lib/rateLimit';

const Body = z.object({
  amount: z.string().regex(/^[0-9]+$/),  // base units
});

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const gate = rateLimit('mint:' + ip, 20, 10_000);
  if (!gate.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  try {
    const { amount } = Body.parse(await req.json());
    const wallet = await getIssuerWallet();
    const txId = await wallet.mintTokens(BigInt(amount));
    return NextResponse.json({ ok: true, txId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 400 });
  }
}
