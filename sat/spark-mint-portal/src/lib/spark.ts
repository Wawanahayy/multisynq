import { IssuerSparkWallet } from '@buildonspark/issuer-sdk';

let cached: Awaited<ReturnType<typeof IssuerSparkWallet.initialize>> | null = null;

/** Wallet issuer dari seed/mnemonic di ENV (ISSUER_MNEMONIC atau ISSUER_SEED_HEX). */
export async function getIssuerWallet() {
  if (cached) return cached.wallet;

  const mnemonicOrSeed =
    (process.env.ISSUER_MNEMONIC || '').trim() ||
    (process.env.ISSUER_SEED_HEX || process.env.ISSUER_SEED || '').trim();

  if (!mnemonicOrSeed) {
    throw new Error('Missing ISSUER_MNEMONIC or ISSUER_SEED_HEX in env');
  }

  const network = (process.env.SPARK_NETWORK || 'MAINNET').toUpperCase();
  cached = await IssuerSparkWallet.initialize({
    mnemonicOrSeed,
    options: { network },
  });
  return cached.wallet;
}

/** Alamat Spark issuer (fallback ke berbagai properti/metode agar kompatibel lintas versi SDK). */
export async function getIssuerAddress(): Promise<string> {
  const w: any = await getIssuerWallet();

  // coba metode async umum
  for (const m of ['getSparkAddress', 'getAddress', 'getPaymentAddress']) {
    const fn = w?.[m];
    if (typeof fn === 'function') {
      const addr = await fn.call(w);
      if (addr) return String(addr);
    }
  }
  // fallback properti
  const maybe = w?.address || w?.sparkAddress || w?.paymentAddress;
  if (maybe) return String(maybe);

  throw new Error('Cannot derive issuer spark address from wallet');
}

/** Dump permukaan API untuk debug (aman untuk build; hanya mengembalikan daftar keys). */
export async function dumpSurface() {
  const w: any = await getIssuerWallet();
  const sdk = safeRequire('@buildonspark/spark-sdk');
  return {
    walletMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(w) || {}).sort(),
    walletProps: Object.keys(w || {}).sort(),
    sdkKeys: Object.keys(sdk || {}),
    sdkDefaultKeys: Object.keys((sdk?.default || {})),
  };
}

function safeRequire(name: string): any { try { return require(name); } catch { return {}; } }
