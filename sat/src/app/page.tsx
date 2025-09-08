'use client';
import { useState } from 'react';

export default function Page() {
  const [addr, setAddr] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [log, setLog] = useState('');
  const [amount, setAmount] = useState('1000000'); // base units

  async function post(path: string, body: any) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    setLog(JSON.stringify(j, null, 2));
  }

  const openSparksat = () => window.open('https://sparksat.app/', '_blank');

  return (
    <main className="space-y-6">
      <h1 className="h1">Spark Minting Portal</h1>
      <p className="text-sm text-neutral-300">
        Issuer-only actions run on the server. Recipients paste <code>sprt1…</code> from Sparksat.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">1) Create Token</h2>
          <button className="btn" onClick={() => post('/api/create-token', { name: 'MyToken', ticker: 'MTK', decimals: 6, maxSupply: '0', freezable: true })}>
            Create Spark Native Token
          </button>
          <p className="text-xs text-neutral-400">Returns txId; copy your <code>btkn1…</code> from issuer tools.</p>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">2) Mint Supply</h2>
          <div className="space-y-2">
            <label className="label">Amount (base units)</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} className="input" />
          </div>
          <button className="btn" onClick={() => post('/api/mint', { amount })}>Mint</button>
          <p className="text-xs text-neutral-400">Mint goes to issuer wallet; distribute via Transfer.</p>
        </section>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">3) Transfer (Airdrop)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Token Identifier (btkn1…)</label>
            <input value={tokenId} onChange={e => setTokenId(e.target.value)} className="input" placeholder="btkn1..." />
          </div>
          <div>
            <label className="label">Recipient Spark Address (sprt1…)</label>
            <input value={addr} onChange={e => setAddr(e.target.value)} className="input" placeholder="sprt1..." />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => post('/api/transfer', { tokenIdentifier: tokenId, receiverSparkAddress: addr, tokenAmount: amount })}>Send</button>
          <button className="btn" onClick={openSparksat}>Open Sparksat</button>
        </div>
        <p className="text-xs text-neutral-400">Open Sparksat, copy your Spark Address, paste here.</p>
      </section>

      <section className="card">
        <h3 className="font-semibold mb-2">Response</h3>
        <pre className="text-xs whitespace-pre-wrap">{log}</pre>
      </section>
    </main>
  );
}
