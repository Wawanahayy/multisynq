export function looksLikeSparkAddress(addr: string) {
  return /^sprt1[0-9a-z]{20,}$/i.test(addr.trim());
}
export function looksLikeTokenId(id: string) {
  return /^btkn1[0-9a-z]{10,}$/i.test(id.trim());
}
export function parseAmountToBigInt(input: string) {
  if (!/^[0-9]+$/.test(input)) throw new Error('amount must be integer (base units)');
  return BigInt(input);
}
