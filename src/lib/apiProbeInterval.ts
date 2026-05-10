/** 헬스·레디 UI 폴링 주기(ms). 기본 20000. 최소 5초·최대 1시간으로 클램프 */
export function defaultApiProbeIntervalMs(): number {
  const raw = import.meta.env.VITE_API_PROBE_INTERVAL_MS;
  const n = raw !== undefined && raw !== "" ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 5000 && n <= 3_600_000) {
    return Math.floor(n);
  }
  return 20000;
}
