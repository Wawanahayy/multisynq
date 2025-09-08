import { IssuerSparkWallet } from "@buildonspark/issuer-sdk";

let cached: Awaited<ReturnType<typeof IssuerSparkWallet.initialize>> | null = null;

export async function getIssuerWallet() {
  if (cached) return cached.wallet;

  const mnemonicOrSeed = process.env.ISSUER_MNEMONIC;
  if (!mnemonicOrSeed) throw new Error("ISSUER_MNEMONIC missing in env");

  const network = (process.env.SPARK_NETWORK || "MAINNET").toUpperCase();

  cached = await IssuerSparkWallet.initialize({
    mnemonicOrSeed,
    options: { network },
  });
  return cached.wallet;
}
