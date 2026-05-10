import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** scrypt 기반 저장 형식: `{saltHex}:{hashHex}` — 평문 비밀번호는 저장하지 않음. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const i = stored.indexOf(":");
  if (i < 1) return false;
  const saltHex = stored.slice(0, i);
  const hashHex = stored.slice(i + 1);
  let salt: Buffer;
  let hash: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    hash = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length !== 16 || hash.length !== 64) return false;
  const check = scryptSync(plain, salt, 64);
  return timingSafeEqual(hash, check);
}
