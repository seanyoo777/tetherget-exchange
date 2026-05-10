/** 로드밸런서 뒤에서 클라이언트 IP·rate limit 정확도를 위해 trust proxy 설정 여부. */
export function shouldTrustProxy(): boolean {
  const t = process.env.TRUST_PROXY?.trim().toLowerCase();
  if (t === "1" || t === "true" || t === "yes") return true;
  if (process.env.TRUST_PROXY === "0" || t === "false" || t === "no") return false;
  if (process.env.RENDER === "true") return true;
  if (Boolean(process.env.RAILWAY_ENVIRONMENT)) return true;
  if (Boolean(process.env.FLY_APP_NAME)) return true;
  return false;
}
