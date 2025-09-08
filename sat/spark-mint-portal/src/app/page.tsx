'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import TokenProgress from '@/components/TokenProgress';

type Lang = 'ENG' | 'ZH';
const looksLikeSpark = (a:string)=>/^sp1[0-9a-z]{20,}$/i.test(a.trim());

type Quote = {
  feeAddress: string;
  amount: string;
  since: number;
  receiver: string;
  tokenId?: string | null;
  payoutBase?: string | null;
  orderToken: string; // kept in state, never rendered
};

const T = {
  ENG: {
    title: 'Pay → Mint BTKN (Spark)',
    intro: 'Enter your sp1 → Generate → pay the unique amount → enter Tx Hash → Verify. Once verified, the system will mint tokens to your address.',
    step1: '1) Your Spark Address (receiver)',
    generate: 'Generate Payment',
    step2: '2) Pay',
    payTo: 'Pay to:',
    uniqueAmount: 'Unique amount:',
    copyAddress: 'Copy Address',
    copyAmount: 'Copy Amount',
    openSparkScan: 'Open on SparkScan',
    step3: '3) Transaction Hash (required)',
    txHash: 'Tx hash',
    required: 'Required',
    payerOptional: 'Payer Spark (optional)',
    payerPlaceholder: 'sp1 payer...',
    txPlaceholder: 'txid...',
    step4: '4) Verify & Mint',
    verifyBtn: 'Verify Payment → Mint BTKN',
    verifying: 'Verifying…',
    rule: 'One tx hash equals one mint. Reuse is blocked.',
    resp: 'Response',
    errNeedSp1: 'Enter a valid sp1…',
    errNeedToken: 'Order token is not ready. Click Generate first.',
    errNeedTx: 'Tx hash is required',
    langENG: 'ENG',
    langZH: 'ZH',
    cooldownMsg: 'Cooling down… please wait.',
    cooldownBtn: (s:number) => `Cooling down… ${s}s`,
    rateLimited: 'Rate limited. Cooling down…',
    tooEarly: 'Too early. Cooling down…',
  },
  ZH: {
    title: '支付 → 铸造 BTKN（Spark）',
    intro: '输入你的 sp1 → 生成 → 按唯一金额支付 → 输入交易哈希 → 验证。验证通过后，系统会把代币铸造到你的地址。',
    step1: '1) 你的 Spark 地址（接收者）',
    generate: '生成支付信息',
    step2: '2) 支付',
    payTo: '支付至：',
    uniqueAmount: '唯一金额：',
    copyAddress: '复制地址',
    copyAmount: '复制金额',
    openSparkScan: '在 SparkScan 打开',
    step3: '3) 交易哈希（必填）',
    txHash: '交易哈希',
    required: '必填',
    payerOptional: '付款方 Spark（可选）',
    payerPlaceholder: 'sp1 付款方…',
    txPlaceholder: '交易哈希…',
    step4: '4) 验证并铸造',
    verifyBtn: '验证支付 → 铸造 BTKN',
    verifying: '验证中…',
    rule: '一笔交易哈希 = 一次铸币。相同哈希不能重复使用。',
    resp: '响应',
    errNeedSp1: '请输入有效的 sp1…',
    errNeedToken: '订单令牌尚未就绪，请先点击生成。',
    errNeedTx: '必须填写交易哈希',
    langENG: 'ENG',
    langZH: 'ZH',
    cooldownMsg: '冷却中… 请稍候。',
    cooldownBtn: (s:number) => `冷却中… ${s} 秒`,
    rateLimited: '已限流，正在冷却…',
    tooEarly: '过早请求，正在冷却…',
  }
} as const;

function toSafeJson(obj:any){
  try{
    return JSON.stringify(obj, (key, value) => (key === 'orderToken' ? '[hidden]' : value), 2);
  }catch{
    try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
  }
}

// cooldown from env
const GENERATE_COOLDOWN_MS = Number(process.env.NEXT_PUBLIC_GENERATE_COOLDOWN_MS ?? '1200');
const VERIFY_COOLDOWN_MS   = Number(process.env.NEXT_PUBLIC_VERIFY_COOLDOWN_MS   ?? '60000');

export default function Page(){
  const [lang, setLang] = useState<Lang>('ENG');
  const t = T[lang];

  const [receiver,setReceiver]=useState('');
  const [payer,setPayer]=useState('');
  const [txId,setTxId]=useState('');
  const [quote,setQuote]=useState<Quote|null>(null);
  const [qr,setQr]=useState<string>('');
  const [log,setLog]=useState('');
  const [verifying,setVerifying]=useState(false);

  // === Cooldown state with live ticker ===
  const [cooldownUntil,setCooldownUntil] = useState<number|null>(null);
  const inCooldown = !!cooldownUntil && cooldownUntil > Date.now();
  const cooldownLeftSec = inCooldown ? Math.max(0, Math.ceil((cooldownUntil - Date.now())/1000)) : 0;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (cooldownUntil === null) return;
    const id = setInterval(() => {
      if (cooldownUntil <= Date.now()) {
        setCooldownUntil(null);
      } else {
        setTick(v => v + 1);
      }
    }, 250);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  function startCooldown(ms:number){
    const dur = Math.max(0, Number(ms)||0);
    if (dur <= 0) { setCooldownUntil(null); return; }
    setCooldownUntil(Date.now() + dur);
  }

  async function requestQuote(){
    setLog('');
    if (inCooldown) { setLog(toSafeJson({ ok:false, error: t.cooldownMsg })); return; }
    if(!looksLikeSpark(receiver)){
      setLog(toSafeJson({ok:false,error:t.errNeedSp1}));
      return;
    }
    startCooldown(GENERATE_COOLDOWN_MS);
    const r = await fetch('/api/paymint/request',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ receiverSparkAddress: receiver })
    });
    const status = r.status; const j = await r.json();
    if (status === 429 || j?.error === 'rate_limited') {
      startCooldown(Number(j?.retryAfterMs ?? VERIFY_COOLDOWN_MS));
      setLog(toSafeJson({ ...j, note: t.rateLimited }));
    } else if (status === 425 || j?.error === 'too_early') {
      const ms = Number(j?.retryAfterMs ?? 5_000);
      startCooldown(ms);
      setLog(toSafeJson({ ...j, note: t.tooEarly }));
    } else {
      setLog(toSafeJson(j));
    }
    if(j.ok) setQuote(j);
  }

  useEffect(()=>{ (async()=>{
    if(!quote){ setQr(''); return; }
    try{ setQr(await QRCode.toDataURL(quote.feeAddress)); }catch{}
  })(); },[quote]);

  async function verifyAndSend(){
    setLog('');
    if (inCooldown) { setLog(toSafeJson({ ok:false, error: t.cooldownMsg })); return; }
    if(!quote?.orderToken){ setLog(toSafeJson({ok:false,error:t.errNeedToken})); return; }
    if(!txId.trim()){ setLog(toSafeJson({ok:false,error:t.errNeedTx})); return; }
    setVerifying(true);

    startCooldown(VERIFY_COOLDOWN_MS);
    const r = await fetch('/api/paymint/verify',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token: quote.orderToken, payerSparkAddress: payer || undefined, txId: txId || undefined })
    });
    const status = r.status; const j = await r.json();

    if (status === 429 || j?.error === 'rate_limited') {
      const ms = Number(j?.retryAfterMs ?? VERIFY_COOLDOWN_MS);
      startCooldown(Math.max(VERIFY_COOLDOWN_MS, ms));
      setLog(toSafeJson({ ...j, note: t.rateLimited }));
    } else if (status === 425 || j?.error === 'too_early') {
      setLog(toSafeJson({ ...j, note: t.tooEarly }));
    } else {
      setLog(toSafeJson(j));
    }

    setVerifying(false);
  }

  const canVerify = !!quote?.orderToken && !!txId.trim() && !verifying && !inCooldown;
  const canGenerate = !verifying && !inCooldown;

  return (
    <main className="space-y-6">
      {/* Progress mint di paling atas */}
      <TokenProgress />

      <div className="flex items-center justify-end gap-2">
        <button className={`btn ${lang==='ENG' ? 'bg-white/20' : ''}`} onClick={()=>setLang('ENG')} aria-pressed={lang==='ENG'}>{T.ENG.langENG}</button>
        <button className={`btn ${lang==='ZH' ? 'bg-white/20' : ''}`} onClick={()=>setLang('ZH')} aria-pressed={lang==='ZH'}>{T.ZH.langZH}</button>
      </div>

      <h1 className="h1">{T[lang].title}</h1>
      <p className="text-sm text-neutral-300">{T[lang].intro}</p>

      {inCooldown && <div className="card text-sm">{T[lang].cooldownMsg} ({cooldownLeftSec}s)</div>}

      <section className="card space-y-3">
        <h2 className="font-semibold">{T[lang].step1}</h2>
        <input className="input" placeholder="sp1..." value={receiver} onChange={e=>setReceiver(e.target.value)} disabled={inCooldown} />
        <button className="btn" onClick={requestQuote} disabled={!canGenerate}>
          {inCooldown ? T[lang].cooldownBtn(cooldownLeftSec) : T[lang].generate}
        </button>
      </section>

      {quote && (
        <section className="card space-y-3">
          <h2 className="font-semibold">{T[lang].step2}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm">{T[lang].payTo}</div>
              <div className="text-xs break-all"><code>{quote.feeAddress}</code></div>
              <div className="mt-2 text-sm">{T[lang].uniqueAmount}</div>
              <div className="text-xs"><code>{quote.amount}</code> sats</div>
              <div className="flex gap-2 mt-3">
                <button className="btn" onClick={()=>navigator.clipboard.writeText(quote.feeAddress)} disabled={inCooldown}>{T[lang].copyAddress}</button>
                <button className="btn" onClick={()=>navigator.clipboard.writeText(quote.amount)} disabled={inCooldown}>{T[lang].copyAmount}</button>
                <button className="btn" onClick={()=>window.open('https://www.sparkscan.io/address/' + quote.feeAddress,'_blank')}>{T[lang].openSparkScan}</button>
              </div>
            </div>
            <div className="flex items-center justify-center">
              {qr && <img src={qr} alt="qr" className="rounded-xl border border-white/10" />}
            </div>
          </div>
        </section>
      )}

      {quote && (
        <section className="card space-y-3">
          <h2 className="font-semibold">{T[lang].step3}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">{T[lang].txHash}</label>
              <input className="input" placeholder={T[lang].txPlaceholder} value={txId} onChange={e=>setTxId(e.target.value)} disabled={inCooldown} />
              <p className="text-xs text-neutral-400 mt-1">{T[lang].required}</p>
            </div>
            <div>
              <label className="label">{T[lang].payerOptional}</label>
              <input className="input" placeholder={T[lang].payerPlaceholder} value={payer} onChange={e=>setPayer(e.target.value)} disabled={inCooldown} />
            </div>
          </div>
        </section>
      )}

      {quote && (
        <section className="card space-y-3">
          <h2 className="font-semibold">{T[lang].step4}</h2>
          <button className="btn" onClick={verifyAndSend} disabled={!canVerify}>
            {inCooldown ? T[lang].cooldownBtn(cooldownLeftSec) : (verifying ? T[lang].verifying : T[lang].verifyBtn)}
          </button>
          <p className="text-xs text-neutral-400">{T[lang].rule}</p>
        </section>
      )}

      <section className="card">
        <h3 className="font-semibold mb-2">{T[lang].resp}</h3>
        <pre className="text-xs whitespace-pre-wrap">{log}</pre>
      </section>
    </main>
  );
}
