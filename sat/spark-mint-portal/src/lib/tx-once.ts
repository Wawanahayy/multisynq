import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DIR = process.env.PAYMINT_TXLOCK_DIR || ".paymint_tx";

/** Hash nama file agar bebas format txId (32hex/64hex/uuid) */
function hashName(s: string) {
  return crypto.createHash("sha256").update(String(s).trim().toLowerCase()).digest("hex").slice(0, 32);
}

/** Klaim lock untuk txId. Sukses kalau belum pernah diklaim. */
export function claimTxOnce(txId: string, meta?: Record<string, any>) {
  const dir = path.join(process.cwd(), DIR);
  fs.mkdirSync(dir, { recursive: true });

  const name = `tx-${hashName(txId)}.lock`;
  const fpath = path.join(dir, name);

  try {
    const fd = fs.openSync(fpath, "wx", 0o600); // atomic create
    const payload = { txId, at: Date.now(), meta: meta ?? null };
    fs.writeFileSync(fd, JSON.stringify(payload, null, 2));
    fs.closeSync(fd);

    let released = false;
    return {
      ok: true as const,
      path: fpath,
      release() {
        if (!released) {
          try { fs.unlinkSync(fpath); } catch {}
          released = true;
        }
      }
    };
  } catch {
    // sudah ada -> sudah dipakai
    return { ok: false as const, path: fpath, error: "already_used" };
  }
}
