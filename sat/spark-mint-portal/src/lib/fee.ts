import { cfg } from "./config";
import { getIssuerWallet } from "./spark";

// DEV: jika verifyStrict=false, cukup minta feeTxId ada (tanpa benar2 cek ledger).
export async function verifyFeePaid(params: { txId?: string }) {
  if (!cfg.feeAddress || cfg.feeAmount <= 0n) return true; // fee off

  if (!cfg.verifyStrict) {
    if (!params.txId || params.txId.length < 4) throw new Error("fee txId required (dev mode)");
    return true;
  }

  // STRICT MODE (contoh kerangka; ganti ke call SDK/ledger check ketika tersedia):
  // const wallet = await getIssuerWallet();
  // await wallet.verifyIncoming({ address: cfg.feeAddress, tokenIdentifier: cfg.feeTokenId || undefined, minAmount: cfg.feeAmount, txId: params.txId! })
  throw new Error("Strict fee verification not implemented yet");
}
