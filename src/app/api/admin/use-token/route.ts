import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setCurrentToken } from '@/lib/state';

const Body = z.object({
  tokenIdentifier: z.string().min(20) // btkn1...
});

export async function POST(req: Request) {
  const key = req.headers.get('x-admin-key');
  if (key !== (process.env.ADMIN_KEY || 'changeme-admin')) {
    return NextResponse.json({ ok:false, error:'unauthorized' }, { status: 401 });
  }
  try {
    const b = Body.parse(await req.json());
    setCurrentToken(b.tokenIdentifier);
    return NextResponse.json({ ok:true, tokenIdentifier: b.tokenIdentifier });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status:400 });
  }
}
