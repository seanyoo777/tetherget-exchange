import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { OrderStatus } from "@tetherget/contracts";
import { PLATFORM_API_VERSION, PlatformErrorCodes } from "@tetherget/contracts";
import {
  haltBodySchema,
  loginSchema,
  orderSchema,
  simMidSchema,
  symbolToggleSchema,
  withdrawalRequestSchema
} from "@tetherget/contracts/schemas";
import { correlationIdMiddleware } from "./correlation-middleware.js";
import { platformApiVersionJsonMiddleware } from "./platform-middleware.js";
import { requestLogMiddleware } from "./request-log-middleware.js";
import { assertJwtConfigOrExit, signAccessToken, verifyAccessToken } from "./auth-jwt.js";
import { hashPassword, verifyPassword } from "./auth-password.js";
import { corsOptionsFromEnv } from "./cors-config.js";
import { sendPlatformError } from "./platform-http.js";
import { shouldTrustProxy } from "./trust-proxy.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 30),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendPlatformError(res, 429, PlatformErrorCodes.RATE_LIMITED, "Too many login attempts");
  }
});

/** 일반 API 부하 완화 — 헬스·레디는 제외. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX ?? 600),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.method === "OPTIONS" ||
    (req.method === "GET" && (req.path === "/api/health" || req.path === "/api/ready")),
  handler: (_req, res) => {
    sendPlatformError(res, 429, PlatformErrorCodes.RATE_LIMITED, "Too many requests");
  }
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXCHANGE_STATE_PATH = join(__dirname, "..", "data", "exchange-state.json");

/** 운영 또는 명시 시 Bearer 없이 `x-role` 헤더를 무시 — 역할 스푸핑 방지. */
const strictAuth =
  process.env.NODE_ENV === "production" || process.env.STRICT_AUTH === "true";

type Role = "SUPER_ADMIN" | "OPS_ADMIN" | "CS_ADMIN" | "TRADER";

type User = {
  id: number;
  email: string;
  role: Role;
  passwordHash: string;
};

type Order = {
  id: number;
  userId: number;
  symbol: string;
  side: "LONG" | "SHORT";
  orderType: "MARKET" | "LIMIT";
  qty: number;
  price: number;
  leverage: number;
  status: OrderStatus;
  reason?: string;
  filledQty: number;
  remainingQty: number;
  feeUsdt: number;
  marginLockedUsdt: number;
  createdAt: string;
};

type Settlement = {
  id: number;
  period: string;
  grossFeeUsdt: number;
  rebateUsdt: number;
  netRevenueUsdt: number;
  status: "READY" | "LOCKED" | "PAID";
};

type KycTicket = {
  id: number;
  user: string;
  level: "BASIC" | "PRO" | "INSTITUTIONAL";
  status: "PENDING" | "APPROVED" | "REJECTED";
};

type ActionLog = {
  id: number;
  at: string;
  actor: string;
  action: string;
  details?: string;
  before?: string;
  after?: string;
  /** HTTP 요청에서 발생 시 `X-Correlation-Id` 와 동일 — 배치 매칭 등은 생략 */
  correlationId?: string;
};

type Withdrawal = {
  id: number;
  userId: number;
  amount: number;
  address: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  riskScore: number;
  riskFactors: string[];
  needsDualApproval: boolean;
  approvedBy: string[];
};

const app = express();
if (shouldTrustProxy()) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

const corsOpts = corsOptionsFromEnv();
app.use(corsOpts ? cors(corsOpts) : cors());
app.use(express.json());
app.use(apiLimiter);
app.use(correlationIdMiddleware);
app.use(requestLogMiddleware);
app.use(platformApiVersionJsonMiddleware);

const demoSeedPassword = process.env.DEMO_SEED_PASSWORD ?? "pass1234";

const users: User[] = [
  { id: 1, email: "super@tetherget.io", role: "SUPER_ADMIN", passwordHash: hashPassword(demoSeedPassword) },
  { id: 2, email: "ops@tetherget.io", role: "OPS_ADMIN", passwordHash: hashPassword(demoSeedPassword) },
  { id: 3, email: "cs@tetherget.io", role: "CS_ADMIN", passwordHash: hashPassword(demoSeedPassword) },
  { id: 4, email: "trader@tetherget.io", role: "TRADER", passwordHash: hashPassword(demoSeedPassword) }
];

const balances = new Map<number, number>([
  [1, 100000],
  [2, 50000],
  [3, 30000],
  [4, 10000]
]);

const orders: Order[] = [];
const settlements: Settlement[] = [
  { id: 1, period: "2026-05-W1", grossFeeUsdt: 30000, rebateUsdt: 8000, netRevenueUsdt: 22000, status: "READY" }
];
const auditLogs: string[] = ["SYSTEM: backend booted"];
const actionLogs: ActionLog[] = [];
const otpSessions = new Map<string, number>();
const kycTickets: KycTicket[] = [
  { id: 1, user: "neo_trader", level: "PRO", status: "PENDING" },
  { id: 2, user: "desk_alpha", level: "INSTITUTIONAL", status: "PENDING" }
];
const withdrawals: Withdrawal[] = [];
type AlertRow = {
  id: number;
  level: "INFO" | "WARN" | "CRITICAL";
  message: string;
  at: string;
  read: boolean;
};
const alerts: AlertRow[] = [];

/** USDT-M 테이커 수수료 (bps). 서버 단일 기준 — 프론트 계산 불신뢰. */
const FUTURES_TAKER_FEE_BPS = 5;
/** 지정가 체결(매칭 엔진) 시 메이커 수수료 (bps). */
const FUTURES_MAKER_FEE_BPS = 2;

let platformTradingHalted = false;
const symbolTradingDisabled = new Set<string>();

/** 단조 증가 주문·출금 ID (재시작 후에도 충돌 방지). */
let nextOrderId = 1;
let nextWithdrawalId = 1;

/** 데모용 심볼별 시뮬 중간가 — 관리자가 갱신하거나 매칭 시 참조. */
const DEFAULT_SYMBOL_MIDS: [string, number][] = [
  ["BTCUSDT", 97000],
  ["ETHUSDT", 3500],
  ["SOLUSDT", 180],
  ["XRPUSDT", 2.2]
];
const symbolMidPrices = new Map<string, number>();

function seedSymbolMidPrices(): void {
  for (const [s, m] of DEFAULT_SYMBOL_MIDS) {
    if (!symbolMidPrices.has(s)) symbolMidPrices.set(s, m);
  }
}

type PersistedExchangeStateV2 = {
  version: 2;
  nextOrderId: number;
  nextWithdrawalId: number;
  balances: [number, number][];
  orders: Order[];
  withdrawals: Withdrawal[];
  platformTradingHalted: boolean;
  symbolTradingDisabled: string[];
  symbolMidPrices: [string, number][];
};

function ensureExchangeDataDir() {
  const dir = dirname(EXCHANGE_STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadPersistedExchangeState(): void {
  try {
    if (!existsSync(EXCHANGE_STATE_PATH)) return;
    const raw = readFileSync(EXCHANGE_STATE_PATH, "utf8");
    const p = JSON.parse(raw) as { version?: number; orders?: Order[] } & Partial<PersistedExchangeStateV2>;
    if (!Array.isArray(p.orders)) return;
    const fileVer: number = typeof p.version === "number" ? p.version : 1;
    if (fileVer !== 1 && fileVer !== 2) return;
    balances.clear();
    for (const row of p.balances ?? []) {
      const [uid, bal] = row;
      if (typeof uid === "number" && typeof bal === "number") balances.set(uid, bal);
    }
    orders.length = 0;
    orders.push(...p.orders);
    withdrawals.length = 0;
    withdrawals.push(...(p.withdrawals ?? []));
    platformTradingHalted = Boolean(p.platformTradingHalted);
    symbolTradingDisabled.clear();
    for (const s of p.symbolTradingDisabled ?? []) symbolTradingDisabled.add(String(s).toUpperCase());
    nextOrderId = Math.max(1, Number(p.nextOrderId) || 1);
    nextWithdrawalId = Math.max(1, Number(p.nextWithdrawalId) || 1);
    const maxOid = orders.reduce((m, o) => Math.max(m, o.id), 0);
    const maxWid = withdrawals.reduce((m, w) => Math.max(m, w.id), 0);
    nextOrderId = Math.max(nextOrderId, maxOid + 1);
    nextWithdrawalId = Math.max(nextWithdrawalId, maxWid + 1);
    symbolMidPrices.clear();
    const mids = p.symbolMidPrices;
    for (const row of mids ?? []) {
      const sym = String(row?.[0] ?? "").toUpperCase();
      const px = Number(row?.[1]);
      if (sym && Number.isFinite(px) && px > 0) symbolMidPrices.set(sym, px);
    }
    seedSymbolMidPrices();
    auditLogs.unshift(`SYSTEM: restored state ${orders.length} orders from disk`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("exchange state load failed", e);
  }
}

function persistExchangeState(): void {
  try {
    ensureExchangeDataDir();
    const payload: PersistedExchangeStateV2 = {
      version: 2,
      nextOrderId,
      nextWithdrawalId,
      balances: [...balances.entries()],
      orders: [...orders],
      withdrawals: [...withdrawals],
      platformTradingHalted,
      symbolTradingDisabled: [...symbolTradingDisabled].sort(),
      symbolMidPrices: [...symbolMidPrices.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    };
    writeFileSync(EXCHANGE_STATE_PATH, JSON.stringify(payload, null, 2), "utf8");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("exchange state persist failed", e);
  }
}

loadPersistedExchangeState();
seedSymbolMidPrices();

function feeOnNotional(notional: number): number {
  return (notional * FUTURES_TAKER_FEE_BPS) / 10000;
}

function makerFeeOnNotional(notional: number): number {
  return (notional * FUTURES_MAKER_FEE_BPS) / 10000;
}

/** LONG 지정가 매수: 시뮬 가격이 주문가 이하로 내려오면 체결 후보. SHORT 지정가 매도: 시뮬 가격이 주문가 이상. */
function limitCrossed(side: Order["side"], limitPx: number, mid: number): boolean {
  if (side === "LONG") return mid <= limitPx;
  return mid >= limitPx;
}

/**
 * 미체결 LIMIT 주문을 시뮬 중간가와 교차 시 부분·전체 체결 (메이커 수수료).
 */
function runMatchingEnginePass(): { touched: number; filled: number; partial: number } {
  let touched = 0;
  let filled = 0;
  let partial = 0;
  const candidates = orders.filter(
    (o) =>
      (o.status === "ACCEPTED" || o.status === "PARTIALLY_FILLED") &&
      o.orderType === "LIMIT" &&
      o.remainingQty > 0
  );
  for (const order of candidates) {
    const mid = symbolMidPrices.get(order.symbol) ?? order.price;
    if (!limitCrossed(order.side, order.price, mid)) continue;

    const remainingBefore = order.remainingQty;
    let dq = remainingBefore * (0.12 + Math.random() * 0.88);
    dq = Math.min(remainingBefore, Number(dq.toFixed(8)));
    if (dq <= 0 || dq < remainingBefore * 0.05) {
      dq = Math.min(remainingBefore, Number((remainingBefore * 0.12).toFixed(8)));
    }
    const sliceNotional = dq * order.price;
    const fee = makerFeeOnNotional(sliceNotional);
    const bal = balances.get(order.userId) ?? 0;
    if (bal < fee) continue;

    balances.set(order.userId, bal - fee);
    order.filledQty = Number((order.filledQty + dq).toFixed(8));
    order.remainingQty = Number((remainingBefore - dq).toFixed(8));
    order.feeUsdt = Number((order.feeUsdt + fee).toFixed(10));
    order.marginLockedUsdt = Number(((order.remainingQty * order.price) / order.leverage).toFixed(8));

    logAction({
      actor: "SYSTEM",
      action: "FEE_RECORDED",
      details: `order=${order.id} makerBps=${FUTURES_MAKER_FEE_BPS} sliceNotional=${sliceNotional.toFixed(6)} feeUsdt=${fee.toFixed(8)} mid=${mid}`
    });

    touched++;
    if (order.remainingQty < 1e-8) {
      order.remainingQty = 0;
      order.marginLockedUsdt = 0;
      order.status = "FILLED";
      filled++;
      auditLogs.unshift(
        `ORDER_MATCH_FILLED: id=${order.id} user=${order.userId} symbol=${order.symbol} mid=${mid}`
      );
    } else {
      order.status = "PARTIALLY_FILLED";
      partial++;
      auditLogs.unshift(
        `ORDER_MATCH_PARTIAL: id=${order.id} dq=${dq} rem=${order.remainingQty} mid=${mid}`
      );
    }
  }
  if (touched > 0) persistExchangeState();
  return { touched, filled, partial };
}

function computeWithdrawalRisk(userId: number, amount: number, address: string): {
  score: number;
  factors: string[];
  needsDualApproval: boolean;
} {
  let score = 0;
  const factors: string[] = [];
  if (amount >= 5000) {
    score += 40;
    factors.push("HIGH_AMOUNT");
  } else if (amount >= 1000) {
    score += 25;
    factors.push("MEDIUM_AMOUNT");
  } else if (amount >= 500) {
    score += 10;
    factors.push("ELEVATED_AMOUNT");
  }
  if (address.length < 24 || /^(test|risk|burn)/i.test(address.trim())) {
    score += 15;
    factors.push("ADDRESS_HEURISTIC_WARN");
  }
  const dayAgo = Date.now() - 86400000;
  const recentSameUser = withdrawals.filter(
    (w) => w.userId === userId && new Date(w.createdAt).getTime() > dayAgo
  ).length;
  if (recentSameUser >= 2) {
    score += 25;
    factors.push("FREQUENT_WITHDRAWALS_24H");
  }
  score = Math.min(100, score);
  const needsDualApproval = score >= 50 || amount >= 2000;
  return { score, factors, needsDualApproval };
}

function hasRole(role: Role, allowed: Role[]) {
  return allowed.includes(role);
}

function resolveUserFromAuth(req: express.Request): User | null {
  const auth = req.headers.authorization;
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) {
    return null;
  }
  const token = auth.slice(7).trim();
  if (!token) return null;

  if (token.startsWith("mock-token-")) {
    if (strictAuth) return null;
    const id = Number(token.replace("mock-token-", ""));
    return users.find((u) => u.id === id) ?? null;
  }

  const payload = verifyAccessToken(token);
  if (!payload) return null;
  const user = users.find((u) => u.id === payload.sub);
  if (!user || user.email !== payload.email || user.role !== payload.role) {
    return null;
  }
  return user;
}

function resolveRole(req: express.Request): Role {
  const authUser = resolveUserFromAuth(req);
  if (strictAuth) {
    return authUser?.role ?? "TRADER";
  }
  if (authUser) return authUser.role;
  const headerRole = req.headers["x-role"] as Role | undefined;
  return headerRole ?? "TRADER";
}

function actorName(req: express.Request): string {
  const authUser = resolveUserFromAuth(req);
  return authUser?.email ?? `role:${resolveRole(req)}`;
}

function logAction(entry: Omit<ActionLog, "id" | "at">, res?: express.Response) {
  const cid = res?.locals.correlationId;
  actionLogs.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    at: new Date().toISOString(),
    ...entry,
    ...(cid ? { correlationId: cid } : {})
  });
}

function pushAlert(level: "INFO" | "WARN" | "CRITICAL", message: string) {
  alerts.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    level,
    message,
    at: new Date().toISOString(),
    read: false
  });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "tetherget-backend",
    platformApiVersion: PLATFORM_API_VERSION,
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    now: new Date().toISOString()
  });
});

/** 레디 프로브 — 상태 파일 디렉터리에 쓰기 가능해야 통과. */
app.get("/api/ready", (_req, res) => {
  try {
    ensureExchangeDataDir();
    const probe = join(dirname(EXCHANGE_STATE_PATH), `.write-probe-${process.pid}`);
    writeFileSync(probe, String(Date.now()), "utf8");
    unlinkSync(probe);
    res.json({
      ok: true,
      ready: true,
      platformApiVersion: PLATFORM_API_VERSION,
      strictAuth,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      now: new Date().toISOString()
    });
  } catch {
    res.status(503).json({
      ok: false,
      ready: false,
      platformApiVersion: PLATFORM_API_VERSION,
      strictAuth,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      now: new Date().toISOString()
    });
  }
});

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendPlatformError(
      res,
      400,
      PlatformErrorCodes.VALIDATION_ERROR,
      "Invalid request",
      parsed.error.flatten()
    );
  }
  const user = users.find((u) => u.email === parsed.data.email);
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return sendPlatformError(res, 401, PlatformErrorCodes.INVALID_CREDENTIALS, "Invalid credentials");
  }
  auditLogs.unshift(`AUTH_LOGIN: user=${user.email}`);
  const token = signAccessToken(user);
  return res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role }
  });
});

app.get("/api/admin/audit", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN", "CS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  return res.json({ items: auditLogs.slice(0, 100) });
});

app.post("/api/admin/otp/verify", (req, res) => {
  const role = resolveRole(req);
  const authUser = resolveUserFromAuth(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN", "CS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (code !== "123456") {
    auditLogs.unshift(`OTP_FAILED: role=${role}`);
    return sendPlatformError(res, 401, PlatformErrorCodes.INVALID_OTP, "Invalid OTP code");
  }
  const identity = authUser?.email ?? `role:${role}`;
  const otpToken = `otp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  otpSessions.set(otpToken, Date.now() + 1000 * 60 * 5);
  auditLogs.unshift(`OTP_VERIFIED: ${identity}`);
  logAction({ actor: identity, action: "OTP_VERIFIED", details: "Admin OTP granted for 5 minutes" }, res);
  return res.json({ otpToken, expiresInSec: 300 });
});

app.get("/api/admin/action-logs", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN", "CS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  return res.json({ items: actionLogs.slice(0, 200) });
});

app.get("/api/admin/alerts", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN", "CS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  const level = typeof req.query.level === "string" ? req.query.level : undefined;
  const unreadOnly = req.query.unreadOnly === "1" || req.query.unreadOnly === "true";
  let list = alerts.slice(0, 200);
  if (level && ["INFO", "WARN", "CRITICAL"].includes(level)) {
    list = list.filter((a) => a.level === level);
  }
  if (unreadOnly) {
    list = list.filter((a) => !a.read);
  }
  return res.json({ items: list.slice(0, 100) });
});

app.post("/api/admin/alerts/:id/read", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN", "CS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  const id = Number(req.params.id);
  const row = alerts.find((a) => a.id === id);
  if (!row) {
    return sendPlatformError(res, 404, PlatformErrorCodes.NOT_FOUND, "Alert not found");
  }
  row.read = true;
  logAction({ actor: actorName(req), action: "ALERT_MARK_READ", details: `alert=${id}` }, res);
  return res.json(row);
});

app.get("/api/admin/kyc", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "CS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  return res.json({ items: kycTickets });
});

app.post("/api/admin/kyc/:id/status", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "CS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  const otpToken = req.headers["x-otp-token"];
  if (typeof otpToken !== "string" || !otpSessions.has(otpToken)) {
    return sendPlatformError(res, 401, PlatformErrorCodes.OTP_REQUIRED, "OTP verification required");
  }
  const expiresAt = otpSessions.get(otpToken) ?? 0;
  if (Date.now() > expiresAt) {
    otpSessions.delete(otpToken);
    return sendPlatformError(res, 401, PlatformErrorCodes.OTP_EXPIRED, "OTP session expired");
  }
  const id = Number(req.params.id);
  const status = req.body?.status as KycTicket["status"] | undefined;
  if (!status || !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    return sendPlatformError(res, 400, PlatformErrorCodes.INVALID_INPUT, "Invalid status");
  }
  const ticket = kycTickets.find((k) => k.id === id);
  if (!ticket) {
    return sendPlatformError(res, 404, PlatformErrorCodes.NOT_FOUND, "KYC ticket not found");
  }
  const before = ticket.status;
  ticket.status = status;
  logAction(
    {
      actor: actorName(req),
      action: "KYC_STATUS_UPDATED",
      details: `ticket=${id} user=${ticket.user}`,
      before,
      after: status
    },
    res
  );
  return res.json(ticket);
});

app.post("/api/order", (req, res) => {
  const authUser = resolveUserFromAuth(req);
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendPlatformError(
      res,
      400,
      PlatformErrorCodes.INVALID_ORDER,
      "Invalid order",
      parsed.error.flatten()
    );
  }

  const input = parsed.data;
  const symbolKey = input.symbol.trim().toUpperCase();

  if (authUser && authUser.role === "TRADER" && authUser.id !== input.userId) {
    return sendPlatformError(
      res,
      403,
      PlatformErrorCodes.FORBIDDEN,
      "Forbidden: cannot place order for another user"
    );
  }

  const reject = (reason: string): express.Response => {
    const oid = nextOrderId++;
    const nextOrder: Order = {
      id: oid,
      ...input,
      symbol: symbolKey,
      status: "REJECTED",
      reason,
      filledQty: 0,
      remainingQty: input.qty,
      feeUsdt: 0,
      marginLockedUsdt: 0,
      createdAt: new Date().toISOString()
    };
    orders.unshift(nextOrder);
    auditLogs.unshift(`ORDER_REJECTED: id=${nextOrder.id} reason=${reason}`);
    logAction(
      {
        actor: actorName(req),
        action: "ORDER_REJECTED",
        details: `order=${nextOrder.id}`,
        after: reason
      },
      res
    );
    persistExchangeState();
    return res.json(nextOrder);
  };

  if (platformTradingHalted) {
    pushAlert("WARN", `Order rejected: trading halted (${symbolKey})`);
    return reject("TRADING_HALTED");
  }
  if (symbolTradingDisabled.has(symbolKey)) {
    return reject("SYMBOL_DISABLED");
  }

  const balance = balances.get(input.userId) ?? 0;
  const notional = input.qty * input.price;
  const margin = notional / input.leverage;
  const takerFee = feeOnNotional(notional);

  let status: OrderStatus = "FILLED";
  let filledQty = input.qty;
  let remainingQty = 0;
  let feeUsdt = 0;
  let marginLockedUsdt = margin;

  if (input.orderType === "LIMIT") {
    if (margin > balance) {
      return reject("INSUFFICIENT_BALANCE");
    }
    status = "ACCEPTED";
    filledQty = 0;
    remainingQty = input.qty;
    feeUsdt = 0;
    marginLockedUsdt = margin;
  } else {
    const required = margin + takerFee;
    if (required > balance) {
      return reject("INSUFFICIENT_BALANCE");
    }
    status = "FILLED";
    filledQty = input.qty;
    remainingQty = 0;
    feeUsdt = takerFee;
    marginLockedUsdt = margin;
    if (notional >= 100000) {
      pushAlert("CRITICAL", `Large notional order: user=${input.userId} notional=${notional.toFixed(2)} USDT`);
    }
  }

  const oid = nextOrderId++;
  const nextOrder: Order = {
    id: oid,
    ...input,
    symbol: symbolKey,
    status,
    filledQty,
    remainingQty,
    feeUsdt,
    marginLockedUsdt,
    createdAt: new Date().toISOString()
  };
  orders.unshift(nextOrder);

  if (feeUsdt > 0) {
    logAction(
      {
        actor: "SYSTEM",
        action: "FEE_RECORDED",
        details: `order=${nextOrder.id} takerBps=${FUTURES_TAKER_FEE_BPS} notional=${notional.toFixed(6)} feeUsdt=${feeUsdt.toFixed(8)}`
      },
      res
    );
  }

  if (status === "ACCEPTED") {
    balances.set(input.userId, balance - marginLockedUsdt);
    auditLogs.unshift(`ORDER_ACCEPTED: id=${nextOrder.id} user=${input.userId} locked=${marginLockedUsdt.toFixed(4)}`);
    logAction(
      {
        actor: actorName(req),
        action: "ORDER_ACCEPTED",
        details: `order=${nextOrder.id} user=${input.userId} symbol=${symbolKey} locked=${marginLockedUsdt.toFixed(4)}`
      },
      res
    );
    persistExchangeState();
    return res.json(nextOrder);
  }

  balances.set(input.userId, balance - margin - feeUsdt);
  auditLogs.unshift(
    `ORDER_FILLED: id=${nextOrder.id} user=${input.userId} margin=${margin.toFixed(2)} fee=${feeUsdt.toFixed(6)}`
  );
  logAction(
    {
      actor: actorName(req),
      action: "ORDER_FILLED",
      details: `order=${nextOrder.id} user=${input.userId} margin=${margin.toFixed(2)} fee=${feeUsdt.toFixed(6)}`
    },
    res
  );
  if (margin > 5000) {
    pushAlert("WARN", `High margin order detected: user=${input.userId} margin=${margin.toFixed(2)}`);
  }

  persistExchangeState();
  return res.json(nextOrder);
});

/**
 * 미체결(LIMIT) 주문 취소 — 취소대기 후 즉시 취소완료(데모 엔진). 잠긴 증거금 환급.
 */
app.post("/api/order/:id/cancel", (req, res) => {
  const authUser = resolveUserFromAuth(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    return sendPlatformError(res, 400, PlatformErrorCodes.INVALID_INPUT, "Invalid order id");
  }
  const order = orders.find((o) => o.id === id);
  if (!order) {
    return sendPlatformError(res, 404, PlatformErrorCodes.NOT_FOUND, "Order not found");
  }
  if (authUser && authUser.role === "TRADER" && order.userId !== authUser.id) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  if (order.status !== "ACCEPTED" && order.status !== "PARTIALLY_FILLED") {
    return sendPlatformError(
      res,
      400,
      PlatformErrorCodes.ORDER_NOT_CANCELLABLE,
      `Order not cancellable in status ${order.status}`,
      { status: order.status }
    );
  }
  const refund = order.marginLockedUsdt;
  order.status = "CANCEL_PENDING";
  logAction(
    {
      actor: actorName(req),
      action: "ORDER_CANCEL_PENDING",
      details: `order=${order.id} user=${order.userId}`,
      before: "ACCEPTED",
      after: "CANCEL_PENDING"
    },
    res
  );
  const bal = balances.get(order.userId) ?? 0;
  balances.set(order.userId, bal + refund);
  order.status = "CANCELLED";
  order.remainingQty = 0;
  order.marginLockedUsdt = 0;
  auditLogs.unshift(`ORDER_CANCELLED: id=${order.id} user=${order.userId} refund=${refund.toFixed(4)}`);
  logAction(
    {
      actor: actorName(req),
      action: "ORDER_CANCELLED",
      details: `order=${order.id} refund=${refund.toFixed(4)}`,
      after: "CANCELLED"
    },
    res
  );
  persistExchangeState();
  return res.json(order);
});

app.get("/api/order", (req, res) => {
  const authUser = resolveUserFromAuth(req);
  const role = resolveRole(req);
  const userIdQuery = Number(req.query.userId);
  const statusQuery = typeof req.query.status === "string" ? req.query.status : undefined;
  const startDateQuery = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
  const endDateQuery = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));
  const filtered = orders
    .filter((o) => {
      if (authUser && role === "TRADER" && o.userId !== authUser.id) {
        return false;
      }
      if (Number.isFinite(userIdQuery) && userIdQuery > 0 && o.userId !== userIdQuery) {
        return false;
      }
      if (statusQuery && o.status !== statusQuery) {
        return false;
      }
      if (startDateQuery && o.createdAt < startDateQuery) {
        return false;
      }
      if (endDateQuery && o.createdAt > endDateQuery) {
        return false;
      }
      return true;
    });
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  res.json({ items, total: filtered.length, page, pageSize });
});

app.get("/api/wallet/:userId", (req, res) => {
  const authUser = resolveUserFromAuth(req);
  const userId = Number(req.params.userId);
  if (authUser && authUser.role === "TRADER" && authUser.id !== userId) {
    return sendPlatformError(
      res,
      403,
      PlatformErrorCodes.FORBIDDEN,
      "Forbidden: wallet access denied"
    );
  }
  const balance = balances.get(userId);
  if (balance === undefined) {
    return sendPlatformError(res, 404, PlatformErrorCodes.NOT_FOUND, "User not found");
  }
  return res.json({ userId, usdt: balance });
});

app.post("/api/withdrawal", (req, res) => {
  const authUser = resolveUserFromAuth(req);
  const parsed = withdrawalRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendPlatformError(
      res,
      400,
      PlatformErrorCodes.VALIDATION_ERROR,
      "Invalid withdrawal payload",
      parsed.error.flatten()
    );
  }
  const { userId, amount, address } = parsed.data;
  if (authUser && authUser.role === "TRADER" && authUser.id !== userId) {
    return sendPlatformError(
      res,
      403,
      PlatformErrorCodes.FORBIDDEN,
      "Forbidden: cannot request withdrawal for another user"
    );
  }
  const balance = balances.get(userId) ?? 0;
  if (amount > balance) {
    return sendPlatformError(res, 400, PlatformErrorCodes.INSUFFICIENT_BALANCE, "Insufficient balance");
  }
  const risk = computeWithdrawalRisk(userId, amount, address);
  const wid = nextWithdrawalId++;
  const next: Withdrawal = {
    id: wid,
    userId,
    amount,
    address,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    riskScore: risk.score,
    riskFactors: risk.factors,
    needsDualApproval: risk.needsDualApproval,
    approvedBy: []
  };
  withdrawals.unshift(next);
  logAction(
    {
      actor: actorName(req),
      action: "WITHDRAWAL_REQUESTED",
      details: `withdrawal=${next.id} user=${userId} amount=${amount} risk=${risk.score} dual=${risk.needsDualApproval}`
    },
    res
  );
  if (risk.needsDualApproval) {
    pushAlert(
      "CRITICAL",
      `Withdrawal requires dual approval: id=${next.id} risk=${risk.score} amount=${amount}`
    );
  } else if (amount >= 1000) {
    pushAlert("CRITICAL", `Large withdrawal pending approval: id=${next.id} amount=${amount}`);
  } else {
    pushAlert("INFO", `Withdrawal requested: id=${next.id} amount=${amount} risk=${risk.score}`);
  }
  persistExchangeState();
  return res.json(next);
});

app.get("/api/admin/withdrawal", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  return res.json({ items: withdrawals.slice(0, 200) });
});

app.post("/api/admin/withdrawal/:id/decision", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  const otpToken = req.headers["x-otp-token"];
  if (typeof otpToken !== "string" || !otpSessions.has(otpToken)) {
    return sendPlatformError(res, 401, PlatformErrorCodes.OTP_REQUIRED, "OTP verification required");
  }
  const expiresAt = otpSessions.get(otpToken) ?? 0;
  if (Date.now() > expiresAt) {
    otpSessions.delete(otpToken);
    return sendPlatformError(res, 401, PlatformErrorCodes.OTP_EXPIRED, "OTP session expired");
  }
  const id = Number(req.params.id);
  const decision = req.body?.decision as "APPROVED" | "REJECTED" | undefined;
  if (!decision || !["APPROVED", "REJECTED"].includes(decision)) {
    return sendPlatformError(res, 400, PlatformErrorCodes.INVALID_INPUT, "Invalid decision");
  }
  const target = withdrawals.find((w) => w.id === id);
  if (!target) {
    return sendPlatformError(res, 404, PlatformErrorCodes.NOT_FOUND, "Withdrawal not found");
  }
  const actor = actorName(req);
  const before = target.status;

  if (decision === "REJECTED") {
    target.status = "REJECTED";
    target.approvedBy = [];
    logAction(
      {
        actor,
        action: "WITHDRAWAL_DECISION",
        details: `withdrawal=${id}`,
        before,
        after: decision
      },
      res
    );
    pushAlert("INFO", `Withdrawal rejected: id=${id} user=${target.userId} amount=${target.amount}`);
    persistExchangeState();
    return res.json({ ...target, awaitingSecondApprover: false });
  }

  if (!target.needsDualApproval) {
    target.status = "APPROVED";
    const balance = balances.get(target.userId) ?? 0;
    balances.set(target.userId, Math.max(0, balance - target.amount));
    logAction(
      {
        actor,
        action: "WITHDRAWAL_DECISION",
        details: `withdrawal=${id}`,
        before,
        after: "APPROVED"
      },
      res
    );
    pushAlert("WARN", `Withdrawal approved: id=${id} user=${target.userId} amount=${target.amount}`);
    return res.json({ ...target, awaitingSecondApprover: false });
  }

  if (target.approvedBy.includes(actor)) {
    return sendPlatformError(
      res,
      400,
      PlatformErrorCodes.DUPLICATE_APPROVAL,
      "Duplicate approval from same actor"
    );
  }
  target.approvedBy.push(actor);
  if (target.approvedBy.length < 2) {
    logAction(
      {
        actor,
        action: "WITHDRAWAL_PARTIAL_APPROVAL",
        details: `withdrawal=${id} round=${target.approvedBy.length}/2`,
        before,
        after: "PENDING_SECOND_APPROVER"
      },
      res
    );
    pushAlert(
      "WARN",
      `Withdrawal awaiting second approver: id=${id} first=${target.approvedBy.join(",")}`
    );
    persistExchangeState();
    return res.json({ ...target, awaitingSecondApprover: true });
  }

  target.status = "APPROVED";
  const balance = balances.get(target.userId) ?? 0;
  balances.set(target.userId, Math.max(0, balance - target.amount));
  logAction(
    {
      actor,
      action: "WITHDRAWAL_DECISION",
      details: `withdrawal=${id} dual complete`,
      before,
      after: "APPROVED"
    },
    res
  );
  pushAlert("WARN", `Withdrawal dual-approved: id=${id} user=${target.userId} amount=${target.amount}`);
  persistExchangeState();
  return res.json({ ...target, awaitingSecondApprover: false });
});

app.get("/api/admin/settlement", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  return res.json({ items: settlements });
});

app.post("/api/admin/settlement/:id/progress", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  const otpToken = req.headers["x-otp-token"];
  if (typeof otpToken !== "string" || !otpSessions.has(otpToken)) {
    return sendPlatformError(res, 401, PlatformErrorCodes.OTP_REQUIRED, "OTP verification required");
  }
  const expiresAt = otpSessions.get(otpToken) ?? 0;
  if (Date.now() > expiresAt) {
    otpSessions.delete(otpToken);
    return sendPlatformError(res, 401, PlatformErrorCodes.OTP_EXPIRED, "OTP session expired");
  }
  const id = Number(req.params.id);
  const target = settlements.find((s) => s.id === id);
  if (!target) {
    return sendPlatformError(res, 404, PlatformErrorCodes.NOT_FOUND, "Settlement not found");
  }
  if (target.status === "READY") target.status = "LOCKED";
  else if (target.status === "LOCKED") target.status = "PAID";
  auditLogs.unshift(`SETTLEMENT_PROGRESS: id=${id} status=${target.status}`);
  logAction(
    {
      actor: actorName(req),
      action: "SETTLEMENT_PROGRESS",
      details: `settlement=${id}`,
      after: target.status
    },
    res
  );
  return res.json(target);
});

app.get("/api/exchange/status", (_req, res) => {
  res.json({
    halted: platformTradingHalted,
    disabledSymbols: [...symbolTradingDisabled].sort(),
    simMidPrices: Object.fromEntries([...symbolMidPrices.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  });
});

app.get("/api/admin/exchange/status", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  res.json({
    halted: platformTradingHalted,
    disabledSymbols: [...symbolTradingDisabled].sort()
  });
});

app.post("/api/admin/exchange/halt", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  const parsed = haltBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendPlatformError(
      res,
      400,
      PlatformErrorCodes.VALIDATION_ERROR,
      "Invalid body",
      parsed.error.flatten()
    );
  }
  platformTradingHalted = parsed.data.halted;
  auditLogs.unshift(`EXCHANGE_HALT: halted=${platformTradingHalted}`);
  logAction(
    {
      actor: actorName(req),
      action: "EXCHANGE_TRADING_HALT",
      details: `halted=${platformTradingHalted}`
    },
    res
  );
  pushAlert(
    platformTradingHalted ? "CRITICAL" : "INFO",
    `Platform trading ${platformTradingHalted ? "HALTED" : "RESUMED"}`
  );
  persistExchangeState();
  return res.json({ halted: platformTradingHalted });
});

app.post("/api/admin/exchange/symbol", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  const parsed = symbolToggleSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendPlatformError(
      res,
      400,
      PlatformErrorCodes.VALIDATION_ERROR,
      "Invalid body",
      parsed.error.flatten()
    );
  }
  const sym = parsed.data.symbol.trim().toUpperCase();
  if (parsed.data.enabled) {
    symbolTradingDisabled.delete(sym);
  } else {
    symbolTradingDisabled.add(sym);
  }
  auditLogs.unshift(`EXCHANGE_SYMBOL: ${sym} enabled=${parsed.data.enabled}`);
  logAction(
    {
      actor: actorName(req),
      action: "EXCHANGE_SYMBOL_TOGGLE",
      details: `symbol=${sym} enabled=${parsed.data.enabled}`
    },
    res
  );
  persistExchangeState();
  return res.json({
    symbol: sym,
    enabled: parsed.data.enabled,
    disabledSymbols: [...symbolTradingDisabled].sort()
  });
});

/** 관리자: 데모용 시뮬 중간가 설정 — LIMIT 매칭에 사용. */
app.post("/api/admin/exchange/sim-mid", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  const parsed = simMidSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendPlatformError(
      res,
      400,
      PlatformErrorCodes.VALIDATION_ERROR,
      "Invalid body",
      parsed.error.flatten()
    );
  }
  const sym = parsed.data.symbol.trim().toUpperCase();
  symbolMidPrices.set(sym, parsed.data.midUsdt);
  auditLogs.unshift(`EXCHANGE_SIM_MID: ${sym}=${parsed.data.midUsdt}`);
  logAction(
    {
      actor: actorName(req),
      action: "EXCHANGE_SIM_MID",
      details: `symbol=${sym} mid=${parsed.data.midUsdt}`
    },
    res
  );
  persistExchangeState();
  return res.json({ symbol: sym, midUsdt: parsed.data.midUsdt });
});

/** 관리자: 매칭 엔진 1회 실행 (LIMIT 교차 시 부분/전체 체결). */
app.post("/api/admin/exchange/match-once", (req, res) => {
  const role = resolveRole(req);
  if (!hasRole(role, ["SUPER_ADMIN", "OPS_ADMIN"])) {
    return sendPlatformError(res, 403, PlatformErrorCodes.FORBIDDEN, "Forbidden");
  }
  const stats = runMatchingEnginePass();
  logAction(
    {
      actor: actorName(req),
      action: "EXCHANGE_MATCH_TICK",
      details: `touched=${stats.touched} filled=${stats.filled} partial=${stats.partial}`
    },
    res
  );
  return res.json(stats);
});

assertJwtConfigOrExit();

const port = Number(process.env.PORT ?? 4000);
const matchTickMs = Number(process.env.MATCH_TICK_MS ?? 8000);

let matchInterval: ReturnType<typeof setInterval> | undefined;

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Tetherget backend running on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Exchange state: ${EXCHANGE_STATE_PATH} (${orders.length} orders, ${withdrawals.length} withdrawals)`);
  // eslint-disable-next-line no-console
  console.log(`strictAuth (no x-role without Bearer): ${strictAuth}`);
  // eslint-disable-next-line no-console
  console.log(`trust proxy: ${shouldTrustProxy()}`);
  if (matchTickMs > 0) {
    matchInterval = setInterval(() => {
      try {
        runMatchingEnginePass();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("MATCH_TICK_FAILED", e);
      }
    }, matchTickMs);
    // eslint-disable-next-line no-console
    console.log(`Matching engine tick every ${matchTickMs}ms (set MATCH_TICK_MS=0 to disable)`);
  }
});

function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`${signal}: graceful shutdown`);
  if (matchInterval) {
    clearInterval(matchInterval);
    matchInterval = undefined;
  }
  persistExchangeState();
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
