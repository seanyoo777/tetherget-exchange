export type HealthProbeTooltipInput = {
  latencyMs: number;
  serverNow: string;
  probedAt: number;
  nodeVersion?: string;
  diskReady?: boolean;
};

/** 헤더 API 줄 `title` — 서버 시각·지연·레디 등 멀티라인 툴팁 */
export function formatHealthProbeTooltip(p: HealthProbeTooltipInput): string {
  let serverLocal = p.serverNow;
  try {
    serverLocal = new Date(p.serverNow).toLocaleString("ko-KR", {
      dateStyle: "short",
      timeStyle: "medium"
    });
  } catch {
    /* invalid date */
  }
  const probedLocal = new Date(p.probedAt).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "medium"
  });
  const lines = [
    `서버 시각: ${serverLocal}`,
    `응답 지연: ${p.latencyMs}ms`,
    `마지막 성공 응답: ${probedLocal}`
  ];
  if (p.nodeVersion) lines.push(`Node: ${p.nodeVersion}`);
  if (p.diskReady !== undefined) {
    lines.push(`레디(디스크 쓰기): ${p.diskReady ? "OK" : "실패"}`);
  }
  return lines.join("\n");
}
