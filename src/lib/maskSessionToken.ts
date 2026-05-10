/** UI용 JWT/세션 토큰 미리보기 — 전체 노출 대신 마지막 4자만 보조 표시. */
export function maskSessionTokenPreview(token: string): string {
  const t = token.trim();
  if (t.length <= 8) return "••••••••";
  return `••••••••…${t.slice(-4)}`;
}
