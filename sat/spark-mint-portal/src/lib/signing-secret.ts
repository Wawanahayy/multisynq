import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_FILE = process.env.PAYMINT_AUTO_SECRET_FILE || ".paymint_secret";

/** Ambil secret dari ENV, atau file .paymint_secret; kalau belum ada → generate & simpan. */
export function getSigningSecretSync(): string {
  const env = process.env.PAYMINT_SIGNING_SECRET;
  if (env && env.length >= 16) return env;

  const file = path.join(process.cwd(), DEFAULT_FILE);
  try {
    if (fs.existsSync(file)) {
      const s = fs.readFileSync(file, "utf8").trim();
      if (s) return s;
    }
  } catch {}

  const s = randomBytes(32).toString("base64url");
  try {
    fs.writeFileSync(file, s, { flag: "wx", mode: 0o600 });
    // eslint-disable-next-line no-console
    console.log(`[paymint] Created ${DEFAULT_FILE} with a new signing secret.`);
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`[paymint] Using ephemeral signing secret (file write failed).`);
  }
  return s;
}
