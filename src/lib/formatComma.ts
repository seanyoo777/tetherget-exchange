/** 천 단위 콤마 (가격·금액 표시용). */

export function formatCommaNumber(value: number, maximumFractionDigits = 8): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const cap = Math.min(16, Math.max(0, maximumFractionDigits));
  const fixed = abs >= 1e15 ? value.toExponential(4) : value.toLocaleString("en-US", { maximumFractionDigits: cap });
  return fixed;
}

/** 입력 문자열에서 숫자만 추출 (콤마·공백 제거). */
export function parseDecimalInput(raw: string): number | null {
  const t = raw.replace(/,/g, "").replace(/\s/g, "").trim();
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
