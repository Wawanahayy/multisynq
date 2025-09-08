import * as cheerio from "cheerio";
import { fetchJsonWithRetry, fetchTextWithRetry } from "./xfetch";

function hyphenateTxId(s: string): string {
  const t = (s || "").trim();
  if (!t || t.includes("-")) return t;
  const hex32 = /^[0-9a-f]{32}$/i;
  if (!hex32.test(t)) return t;
  return `${t.slice(0,8)}-${t.slice(8,12)}-${t.slice(12,16)}-${t.slice(16,20)}-${t.slice(20)}`;
}
function variants(n: bigint): string[] {
  const s = n.toString();
  const out = new Set([s]);
  const rev = s.split("").reverse();
  const parts: string[] = [];
  for (let i = 0; i < rev.length; i += 3) parts.push(rev.slice(i, i + 3).reverse().join(""));
  const grouped = parts.reverse().join(",");
  out.add(grouped);
  out.add(grouped.replace(/,/g, "."));
  out.add(grouped.replace(/,/g, " "));
  return [...out];
}

const NETWORK = (process.env.SPARK_NETWORK || "MAINNET").toUpperCase();
const MODE = ((process.env.VERIFIER_MODE || "SCRAPE_SPARKSCAN").toUpperCase());

export async function verifyTxInvolves(
  txId: string,
  feeAddress: string,
  opts?: { payer?: string; amount?: bigint }
): Promise<{ ok: boolean; source: "api" | "scrape" | null; reason?: string; amountSats?: bigint }> {
  if (!txId || !feeAddress) return { ok: false, source: null, reason: "missing_params" };
  if (MODE === "NONE") return { ok: true, source: null };

  const candidates = [hyphenateTxId(txId), txId].filter(Boolean);
  for (const id of candidates) {
    const url = `https://api.sparkscan.io/v1/tx/${encodeURIComponent(id)}?network=${encodeURIComponent(NETWORK)}`;
    try {
      const data: any = await fetchJsonWithRetry(url, { retries: 3, backoffMs: 600 });
      const to = String(data?.to?.identifier || "");
      const from = String(data?.from?.identifier || "");
      const status = String(data?.status || "").toLowerCase();
      const amount = data?.amountSats != null ? BigInt(String(data.amountSats)) : 0n;

      if (!to || to.toLowerCase() !== feeAddress.toLowerCase()) return { ok: false, source: "api", reason: "to_mismatch" };
      if (opts?.payer && (!from || from.toLowerCase() !== (opts.payer || "").toLowerCase()))
        return { ok: false, source: "api", reason: "from_mismatch" };
      if (opts?.amount && amount < opts.amount)
        return { ok: false, source: "api", reason: `amount_lt_min(${amount} < ${opts.amount})`, amountSats: amount };
      if (status && !["confirmed", "completed", "success"].includes(status))
        return { ok: false, source: "api", reason: `bad_status(${status})`, amountSats: amount };

      return { ok: true, source: "api", amountSats: amount };
    } catch {}
  }

  try {
    const canonical = hyphenateTxId(txId);
    const html = await fetchTextWithRetry(`https://www.sparkscan.io/tx/${encodeURIComponent(canonical)}`, { retries: 3, backoffMs: 600 });
    const $ = cheerio.load(html);
    const text = $("body").text() || "";
    if (!text.includes(canonical) || !text.includes(feeAddress)) return { ok: false, source: "scrape", reason: "no_match_base" };
    if (opts?.payer && !text.includes(opts.payer)) return { ok: false, source: "scrape", reason: "payer_not_found" };
    if (opts?.amount && !variants(opts.amount).some((v) => text.includes(v)))
      return { ok: false, source: "scrape", reason: "amount_not_found" };
    return { ok: true, source: "scrape" };
  } catch (e: any) {
    return { ok: false, source: "scrape", reason: String(e?.message || e) };
  }
}

export async function verifyIncomingByAddress(
  toAddress: string,
  minAmount: bigint,
  payerAddress?: string
): Promise<boolean> {
  if (!toAddress || minAmount <= 0n) return false;
  if (MODE === "NONE") return true;

  const html = await fetchTextWithRetry(`https://www.sparkscan.io/address/${encodeURIComponent(toAddress)}`, { retries: 3, backoffMs: 600 });
  const $ = cheerio.load(html);
  const text = $("body").text() || "";
  const hasAmt = variants(minAmount).some((v) => text.includes(v));
  if (!hasAmt) return false;
  if (payerAddress) return text.includes(payerAddress);
  return true;
}
