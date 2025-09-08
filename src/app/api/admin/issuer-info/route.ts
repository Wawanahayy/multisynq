import { NextResponse } from 'next/server';
import { getIssuerWallet } from '@/lib/spark';

export async function GET(req: Request) {
  const key = req.headers.get('x-admin-key');
  if (key !== (process.env.ADMIN_KEY || 'changeme-admin')) {
    return NextResponse.json({ ok:false, error:'unauthorized' }, { status: 401 });
  }
  try {
    const wallet = await getIssuerWallet();
    const address = await wallet.getSparkAddress?.();
    const pubkey = await wallet.getPublicKey?.();
    const network = (process.env.SPARK_NETWORK || 'MAINNET').toUpperCase();
    return NextResponse.json({ ok:true, address, pubkey, network });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status:400 });
  }
}
