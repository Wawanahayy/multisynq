import { getIssuerWalletSimple } from "./issuer-simple";

/**
 * Mint ke alamat issuer, lalu transfer ke penerima (sp1 user).
 * Keduanya dalam base units (bigint), token by btkn1…
 */
export async function mintThenTransfer(params: {
  tokenIdentifier: string;
  tokenAmount: bigint;
  receiverSparkAddress: string;
}) {
  const { tokenIdentifier, tokenAmount, receiverSparkAddress } = params;

  const wallet = await getIssuerWalletSimple();

  // 1) Mint ke alamat issuer
  const mintTxId = await wallet.mintTokens(tokenAmount);
  // 2) Transfer ke user
  const transferTxId = await wallet.transferTokens({
    tokenIdentifier,
    tokenAmount,
    receiverSparkAddress,
  });

  return { mintTxId: String(mintTxId), transferTxId: String(transferTxId) };
}
