/**
 * Anti re-deem sederhana berbasis memori.
 * NOTE: untuk produksi, ganti ke Redis/DB agar tetap berlaku setelah restart.
 */
const used = new Set<string>();

export function alreadyUsed(token: string): boolean {
  return used.has(token);
}

export function markUsed(token: string): void {
  used.add(token);
}
