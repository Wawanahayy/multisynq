import { NextResponse } from "next/server";

function ok(req: Request) {
  const want = process.env.ADMIN_SECRET || "";
  const got = req.headers.get("x-admin-key") || "";
  return want && got && want === got;
}

type Body = { ticker: string; issuerAddress: string };

export async function POST(req: Request) {
  if (!ok(req)) return NextResponse.json({ ok:false, error:"unauthorized" }, { status:401 });

  try {
    const { ticker, issuerAddress } = (await req.json()) as Body;
    if (!ticker || !issuerAddress)
      return NextResponse.json({ ok:false, error:"ticker & issuerAddress required" }, { status:400 });

    const net = (process.env.SPARK_NETWORK || "MAINNET").toUpperCase();
    const url = `https://www.sparkscan.io/address/${encodeURIComponent(issuerAddress)}?network=${encodeURIComponent(net)}`;

    const r = await fetch(url, { headers: { accept: "text/html,application/xhtml+xml" } });
    if (!r.ok) return NextResponse.json({ ok:false, error:`sparkscan ${r.status}` }, { status:r.status });

    const html = await r.text();
    const text = html; // cukup regex langsung

    // kumpulkan semua btkn1...
    const re = /(btkn1[0-9a-z]{20,})/ig;
    const hits: Array<{ tokenId: string; index: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) hits.push({ tokenId: m[1], index: m.index });

    if (!hits.length)
      return NextResponse.json({ ok:false, error:"no_btkn_found_on_address_page", url }, { status:404 });

    // pilih yang paling dekat dengan teks ticker
    const WANT = ticker.toUpperCase();
    let best: { tokenId: string; dist: number } | null = null;
    for (const h of hits) {
      const winStart = Math.max(0, h.index - 500);
      const winEnd   = Math.min(text.length, h.index + 500);
      const win      = text.slice(winStart, winEnd).toUpperCase();
      const pos      = win.indexOf(WANT);
      if (pos >= 0) {
        const dist = Math.abs((winStart + pos) - h.index);
        if (!best || dist < best.dist) best = { tokenId: h.tokenId, dist };
      }
    }

    if (!best)
      return NextResponse.json({ ok:false, error:"ticker_not_near_any_btkn", url, candidates: hits.map(h=>h.tokenId) }, { status:404 });

    return NextResponse.json({ ok:true, issuer: issuerAddress, tokenIdentifier: best.tokenId, url });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status:400 });
  }
}
