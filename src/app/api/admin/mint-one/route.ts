import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getIssuerWallet } from '@/lib/spark';
import { getCurrentToken } from '@/lib/state';

const Body = z.object({
  tokenIdentifier: z.string().min(20).optional(),
  to: z.string().min(10).optional(), // spark address
  decimals: z.coerce.number().int().min(0).max(18).default(6)
});

export async function POST(req: Request) {
  const key = req.headers.get('x-admin-key');
  if (key !== (process.env.ADMIN_KEY || 'changeme-admin')) {
    return NextResponse.json({ ok:false, error:'unauthorized' }, { status: 401 });
  }
  try {
    const b = Body.parse(await req.json());
    const wallet = await getIssuerWallet();

    const tokenIdentifier = b.tokenIdentifier || getCurrentToken();
    if (!tokenIdentifier) {
      return NextResponse.json({ ok:false, error:'no_token_identifier' }, { status: 400 });
    }

    const to = b.to || (process.env.ISSUER_SPARK_ADDRESS || await wallet.getSparkAddress());
    const amount = 10n ** BigInt(b.decimals); // 1 token di base units

    const txId: string = await wallet.mintToken({
      tokenIdentifier,
      toSparkAddress: to,
      tokenAmount: amount,
    });

    return NextResponse.json({ ok:true, txId, tokenIdentifier, to, amount: amount.toString() });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status:400 });
  }
}
