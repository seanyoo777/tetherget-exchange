import type { OrderStatus } from "@tetherget/contracts";
import {
  PlatformApiError,
  PlatformHttpHeaders,
  isPlatformErrorBody,
  newCorrelationId
} from "@tetherget/contracts";

export { PlatformApiError, PlatformErrorCodes, PlatformHttpHeaders, newCorrelationId } from "@tetherget/contracts";

/** 비우면 같은 도메인의 `/api`로 요청 → Vite 프록시가 백엔드(4000)로 넘김. 터널 URL 공유 시 필수. */
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

function perfNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** fetch 완료 시점까지 라운드트립(ms) — 기존 pingHealth/pingReady 와 동일 기준 */
async function fetchTextMeasured(path: string): Promise<{ text: string; latencyMs: number; res: Response }> {
  const t0 = perfNow();
  const res = await fetch(apiUrl(path));
  const latencyMs = Math.max(0, Math.round(perfNow() - t0));
  const text = await res.text();
  return { text, latencyMs, res };
}

/** Zod 런타임 없이 타입만 — 번들에 `zod` 미포함 (`import type` / `export type` 만 사용). */
import type {
  ExchangeHaltBody,
  ExchangeSimMidBody,
  ExchangeSymbolToggleBody,
  HealthResponse,
  LoginRequestBody,
  OrderCreateBody,
  ReadyResponse,
  WithdrawalRequestBody
} from "@tetherget/contracts/schemas";

export type {
  ExchangeHaltBody,
  ExchangeSimMidBody,
  ExchangeSymbolToggleBody,
  HealthResponse,
  LoginRequestBody,
  OrderCreateBody,
  ReadyResponse,
  WithdrawalRequestBody
};

export type ApiRole = "SUPER_ADMIN" | "OPS_ADMIN" | "CS_ADMIN" | "TRADER";

export type LoginResponse = {
  token: string;
  user: {
    id: number;
    email: string;
    role: ApiRole;
  };
};

export type ApiOrderInput = {
  userId: number;
  symbol: string;
  side: "LONG" | "SHORT";
  orderType: "MARKET" | "LIMIT";
  qty: number;
  price: number;
  leverage: number;
};

/** 백엔드 주문 상태 — `@tetherget/contracts` 와 동일. */
export type ApiOrderStatus = OrderStatus;

export type ApiOrderResult = {
  id: number;
  userId: number;
  symbol: string;
  side: "LONG" | "SHORT";
  orderType: "MARKET" | "LIMIT";
  qty: number;
  price: number;
  leverage: number;
  status: ApiOrderStatus;
  reason?: string;
  filledQty: number;
  remainingQty: number;
  feeUsdt: number;
  marginLockedUsdt: number;
  createdAt: string;
};

/** GET /api/health — 인증 불필요. 라운드트립 지연(ms)과 함께 반환. */
export async function pingHealth(): Promise<{ body: HealthResponse; latencyMs: number }> {
  const { text, latencyMs, res } = await fetchTextMeasured("/api/health");
  if (!res.ok) {
    throw new Error(text || `health ${res.status}`);
  }
  let raw: unknown = {};
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `health ${res.status}`);
  }
  const body = raw as HealthResponse;
  return { body, latencyMs };
}

/** GET /api/ready — 200 또는 503 모두 JSON 본문이 오면 파싱해 반환(레디 프로브용). */
export async function pingReady(): Promise<{ body: ReadyResponse; latencyMs: number }> {
  const { text, latencyMs, res } = await fetchTextMeasured("/api/ready");
  let raw: unknown = {};
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `ready ${res.status}`);
  }
  const body = raw as ReadyResponse;
  if (res.ok || res.status === 503) {
    return { body, latencyMs };
  }
  throw new Error(text || `ready ${res.status}`);
}

function mergeRequestHeaders(init?: RequestInit): HeadersInit {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  const extra = init?.headers;
  if (extra instanceof Headers) {
    const h = new Headers(base);
    extra.forEach((v, k) => h.set(k, v));
    if (!h.has(PlatformHttpHeaders.CORRELATION_ID) && !h.has("x-correlation-id")) {
      h.set(PlatformHttpHeaders.CORRELATION_ID, newCorrelationId());
    }
    return h;
  }
  const merged: Record<string, string> = {
    ...base,
    ...(extra as Record<string, string> | undefined)
  };
  if (!merged[PlatformHttpHeaders.CORRELATION_ID] && !merged["x-correlation-id"]) {
    merged[PlatformHttpHeaders.CORRELATION_ID] = newCorrelationId();
  }
  return merged;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: mergeRequestHeaders(init)
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(text || `API request failed: ${res.status}`);
    }
    if (parsed && isPlatformErrorBody(parsed)) {
      throw new PlatformApiError(res.status, parsed.error.code, parsed.error.message, parsed.error.details);
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AUTH_ERROR:${res.status}`);
    }
    const legacy = parsed as { message?: string } | null;
    throw new Error(legacy?.message ?? (text || `API request failed: ${res.status}`));
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

function withAuth(token?: string): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function login(email: string, password: string) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function postOrder(input: ApiOrderInput, token?: string) {
  return request<ApiOrderResult>("/api/order", {
    method: "POST",
    headers: withAuth(token),
    body: JSON.stringify(input)
  });
}

/** 미체결(LIMIT·ACCEPTED) 주문 취소 — 서버에서 증거금 환급 후 `CANCELLED`. */
export function cancelOrder(orderId: number, token?: string) {
  return request<ApiOrderResult>(`/api/order/${orderId}/cancel`, {
    method: "POST",
    headers: withAuth(token)
  });
}

export function getWallet(userId: number, token?: string) {
  return request<{ userId: number; usdt: number }>(`/api/wallet/${userId}`, {
    headers: withAuth(token)
  });
}

export function getAdminAudit(role: ApiRole, token?: string) {
  return request<{ items: string[] }>("/api/admin/audit", {
    headers: { ...withAuth(token), "x-role": role }
  });
}

export function getAdminSettlement(role: ApiRole, token?: string) {
  return request<{
    items: Array<{
      id: number;
      period: string;
      grossFeeUsdt: number;
      rebateUsdt: number;
      netRevenueUsdt: number;
      status: "READY" | "LOCKED" | "PAID";
    }>;
  }>("/api/admin/settlement", {
    headers: { ...withAuth(token), "x-role": role }
  });
}

export function progressSettlement(role: ApiRole, id: number, token?: string, otpToken?: string) {
  return request<{
    id: number;
    period: string;
    grossFeeUsdt: number;
    rebateUsdt: number;
    netRevenueUsdt: number;
    status: "READY" | "LOCKED" | "PAID";
  }>(`/api/admin/settlement/${id}/progress`, {
    method: "POST",
    headers: { ...withAuth(token), "x-role": role, ...(otpToken ? { "x-otp-token": otpToken } : {}) }
  });
}

export function verifyAdminOtp(role: ApiRole, code: string, token?: string) {
  return request<{ otpToken: string; expiresInSec: number }>("/api/admin/otp/verify", {
    method: "POST",
    headers: { ...withAuth(token), "x-role": role },
    body: JSON.stringify({ code })
  });
}

export function getAdminKyc(role: ApiRole, token?: string) {
  return request<{
    items: Array<{
      id: number;
      user: string;
      level: "BASIC" | "PRO" | "INSTITUTIONAL";
      status: "PENDING" | "APPROVED" | "REJECTED";
    }>;
  }>("/api/admin/kyc", {
    headers: { ...withAuth(token), "x-role": role }
  });
}

export function updateAdminKycStatus(
  role: ApiRole,
  id: number,
  status: "PENDING" | "APPROVED" | "REJECTED",
  token?: string,
  otpToken?: string
) {
  return request<{
    id: number;
    user: string;
    level: "BASIC" | "PRO" | "INSTITUTIONAL";
    status: "PENDING" | "APPROVED" | "REJECTED";
  }>(`/api/admin/kyc/${id}/status`, {
    method: "POST",
    headers: { ...withAuth(token), "x-role": role, ...(otpToken ? { "x-otp-token": otpToken } : {}) },
    body: JSON.stringify({ status })
  });
}

export function getAdminActionLogs(role: ApiRole, token?: string) {
  return request<{
    items: Array<{
      id: number;
      at: string;
      actor: string;
      action: string;
      details?: string;
      before?: string;
      after?: string;
      correlationId?: string;
    }>;
  }>("/api/admin/action-logs", {
    headers: { ...withAuth(token), "x-role": role }
  });
}

export function getAdminAlerts(role: ApiRole, token?: string) {
  return request<{
    items: Array<{ id: number; level: "INFO" | "WARN" | "CRITICAL"; message: string; at: string }>;
  }>("/api/admin/alerts", {
    headers: { ...withAuth(token), "x-role": role }
  });
}

export function createWithdrawal(input: { userId: number; amount: number; address: string }, token?: string) {
  return request<{
    id: number;
    userId: number;
    amount: number;
    address: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
  }>("/api/withdrawal", {
    method: "POST",
    headers: withAuth(token),
    body: JSON.stringify(input)
  });
}

export function getAdminWithdrawals(role: ApiRole, token?: string) {
  return request<{
    items: Array<{
      id: number;
      userId: number;
      amount: number;
      address: string;
      status: "PENDING" | "APPROVED" | "REJECTED";
      createdAt: string;
    }>;
  }>("/api/admin/withdrawal", {
    headers: { ...withAuth(token), "x-role": role }
  });
}

export function decideAdminWithdrawal(
  role: ApiRole,
  id: number,
  decision: "APPROVED" | "REJECTED",
  token?: string,
  otpToken?: string
) {
  return request<{
    id: number;
    userId: number;
    amount: number;
    address: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
  }>(`/api/admin/withdrawal/${id}/decision`, {
    method: "POST",
    headers: { ...withAuth(token), "x-role": role, ...(otpToken ? { "x-otp-token": otpToken } : {}) },
    body: JSON.stringify({ decision })
  });
}

export function getExchangePublicStatus() {
  return request<{
    halted: boolean;
    disabledSymbols: string[];
    simMidPrices?: Record<string, number>;
  }>("/api/exchange/status");
}

export function getAdminExchangeStatus(role: ApiRole, token?: string) {
  return request<{ halted: boolean; disabledSymbols: string[] }>("/api/admin/exchange/status", {
    headers: { ...withAuth(token), "x-role": role }
  });
}

export function postAdminExchangeHalt(role: ApiRole, halted: boolean, token?: string) {
  return request<{ halted: boolean }>("/api/admin/exchange/halt", {
    method: "POST",
    headers: { ...withAuth(token), "x-role": role },
    body: JSON.stringify({ halted })
  });
}

export function postAdminExchangeSymbol(role: ApiRole, symbol: string, enabled: boolean, token?: string) {
  return request<{ symbol: string; enabled: boolean; disabledSymbols: string[] }>("/api/admin/exchange/symbol", {
    method: "POST",
    headers: { ...withAuth(token), "x-role": role },
    body: JSON.stringify({ symbol, enabled })
  });
}

export function postAdminExchangeSimMid(role: ApiRole, symbol: string, midUsdt: number, token?: string) {
  return request<{ symbol: string; midUsdt: number }>("/api/admin/exchange/sim-mid", {
    method: "POST",
    headers: { ...withAuth(token), "x-role": role },
    body: JSON.stringify({ symbol, midUsdt })
  });
}

export function postAdminExchangeMatchOnce(role: ApiRole, token?: string) {
  return request<{ touched: number; filled: number; partial: number }>("/api/admin/exchange/match-once", {
    method: "POST",
    headers: { ...withAuth(token), "x-role": role }
  });
}

export function getOrders(
  params?: {
    userId?: number;
    status?: ApiOrderStatus;
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
  },
  token?: string
) {
  const search = new URLSearchParams();
  if (params?.userId) {
    search.set("userId", String(params.userId));
  }
  if (params?.status) {
    search.set("status", params.status);
  }
  if (params?.page) {
    search.set("page", String(params.page));
  }
  if (params?.pageSize) {
    search.set("pageSize", String(params.pageSize));
  }
  if (params?.startDate) {
    search.set("startDate", params.startDate);
  }
  if (params?.endDate) {
    search.set("endDate", params.endDate);
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return request<{
    items: ApiOrderResult[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/api/order${suffix}`, {
    headers: withAuth(token)
  });
}
