import jwt, { type JwtPayload } from "jsonwebtoken";

export type AccessTokenPayload = {
  sub: number;
  email: string;
  role: string;
};

const DEV_FALLBACK_SECRET =
  "dev-only-jwt-secret-min-32-characters-do-not-use-in-production";

function resolveSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!fromEnv || fromEnv.length < 32) {
      throw new Error("JWT_SECRET must be set and at least 32 characters in production");
    }
    return fromEnv;
  }
  return fromEnv && fromEnv.length >= 32 ? fromEnv : DEV_FALLBACK_SECRET;
}

let cachedSecret: string | null = null;

export function getJwtSecret(): string {
  if (!cachedSecret) {
    cachedSecret = resolveSecret();
  }
  return cachedSecret;
}

/** 부팅 시점 검증 — 실패 시 프로세스 종료용. */
export function assertJwtConfigOrExit(): void {
  try {
    getJwtSecret();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("JWT config error:", e);
    process.exit(1);
  }
}

export function signAccessToken(user: { id: number; email: string; role: string }): string {
  const expiresIn = Number(process.env.JWT_EXPIRES_SEC ?? 86_400);
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 86_400, algorithm: "HS256" }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const p = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as JwtPayload;
    const sub = Number(p.sub);
    if (!Number.isFinite(sub) || sub < 1) return null;
    if (typeof p.email !== "string" || typeof p.role !== "string") return null;
    return { sub, email: p.email, role: p.role };
  } catch {
    return null;
  }
}
