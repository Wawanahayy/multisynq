export const cfg = {
  verifierMode: (process.env.FEE_VERIFIER_MODE || "SCRAPE_SPARKSCAN").toUpperCase(),
  paymint: {
    feeAddress: process.env.PAYMINT_FEE_SPARK_ADDRESS || "",
    basePrice: BigInt(process.env.PAYMINT_PRICE_SATS || "0"),
    tokenId: process.env.PAYMINT_TOKEN_IDENTIFIER || "",
    payoutBase: BigInt(process.env.PAYMINT_TOKEN_PAYOUT_BASE || "0"),
  }
};
