import { useEffect, useState } from "react";
import { pingHealth, pingReady } from "../lib/api";
import { defaultApiProbeIntervalMs } from "../lib/apiProbeInterval";

const DEFAULT_PROBE_INTERVAL_MS = defaultApiProbeIntervalMs();

export type ApiHealthProbeState = {
  latencyMs: number;
  platformApiVersion: string;
  uptimeSeconds?: number;
  serverNow: string;
  probedAt: number;
  nodeVersion?: string;
  /** `/api/ready` 성공 시만 — 상태 디렉터리 쓰기 가능 여부 */
  diskReady?: boolean;
} | null;

/** 주기적 GET /api/health + /api/ready — 헤더·탭 제목용 */
export function useApiHealthProbe(pollIntervalMs = DEFAULT_PROBE_INTERVAL_MS): {
  apiHealthProbe: ApiHealthProbeState;
  apiProbeSettled: boolean;
} {
  const [apiHealthProbe, setApiHealthProbe] = useState<ApiHealthProbeState>(null);
  const [apiProbeSettled, setApiProbeSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const attemptPing = () =>
      pingHealth()
        .then(({ body, latencyMs }) => ({
          ok: true as const,
          latencyMs,
          platformApiVersion: body.platformApiVersion,
          uptimeSeconds: body.uptimeSeconds,
          serverNow: body.now,
          nodeVersion: body.nodeVersion,
          probedAt: Date.now()
        }))
        .catch(() => ({ ok: false as const }));

    const attemptReady = () =>
      pingReady()
        .then(({ body }) => ({ ok: true as const, diskReady: body.ready }))
        .catch(() => ({ ok: false as const }));

    const run = async () => {
      let [r, rd] = await Promise.all([attemptPing(), attemptReady()]);
      if (!r.ok && !cancelled) {
        await new Promise((res) => window.setTimeout(res, 1500));
        [r, rd] = await Promise.all([attemptPing(), attemptReady()]);
      }
      if (cancelled) return;
      if (r.ok) {
        setApiHealthProbe({
          latencyMs: r.latencyMs,
          platformApiVersion: r.platformApiVersion,
          uptimeSeconds: r.uptimeSeconds,
          serverNow: r.serverNow,
          nodeVersion: r.nodeVersion,
          probedAt: r.probedAt,
          diskReady: rd.ok ? rd.diskReady : undefined
        });
      } else {
        setApiHealthProbe(null);
      }
      setApiProbeSettled((s) => s || true);
    };
    run();
    const id = window.setInterval(run, pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollIntervalMs]);

  return { apiHealthProbe, apiProbeSettled };
}
