export function looksLikeSparkAddress(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  // Simple check: bech32m spark address diawali "sp1"
  return /^sp1[0-9a-z]{20,100}$/i.test(s.trim());
}

export function looksLikeTokenId(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  // btkn bech32m (kasar)
  return /^btkn1[0-9a-z]{10,}$/i.test(s.trim());
}

/** Terima: 32-hex (16B), 64-hex (32B), atau UUID 8-4-4-4-12 */
export function looksLikeTxId(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  const hex32 = /^[0-9a-fA-F]{32}$/;
  const hex64 = /^[0-9a-fA-F]{64}$/;
  const dashed = /^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
  return hex32.test(t) || hex64.test(t) || dashed.test(t);
}

/** Integer-only → BigInt */
export function parseAmountToBigInt(x: string | number | bigint): bigint {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') {
    if (!Number.isFinite(x) || !Number.isInteger(x)) throw new Error('Amount must be an integer');
    return BigInt(x);
  }
  if (typeof x === 'string') {
    if (!/^[0-9]+$/.test(x)) throw new Error('Amount string must be integer digits only');
    return BigInt(x);
  }
  throw new Error('Unsupported amount type');
}
