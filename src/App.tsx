import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  ApiOrderStatus,
  ApiRole,
  getAdminAudit,
  getAdminActionLogs,
  getAdminAlerts,
  getAdminExchangeStatus,
  getAdminKyc,
  getAdminSettlement,
  getAdminWithdrawals,
  getExchangePublicStatus,
  getOrders,
  getWallet,
  login,
  createWithdrawal,
  cancelOrder,
  postAdminExchangeHalt,
  postAdminExchangeMatchOnce,
  postAdminExchangeSimMid,
  postAdminExchangeSymbol,
  postOrder,
  progressSettlement,
  decideAdminWithdrawal,
  updateAdminKycStatus,
  verifyAdminOtp
} from "./lib/api";
import { fetchBitgetMixUsdtOrderBook } from "./lib/bitgetDepth";
import { fetchBitgetMixUsdtAllTickers } from "./lib/bitgetTickers";
import { subscribeBitgetMixBooks15 } from "./lib/bitgetMixWsBook";
import { calcLiquidationPrice, calcUnrealizedPnl, priceDecimalsForTick, validateOrder } from "./lib/trading";
import { tradingViewSymbol } from "./lib/tradingViewSymbol";
import { TradingViewEmbed } from "./components/TradingViewEmbed";

type OrderSide = "LONG" | "SHORT";
type OrderType = "MARKET" | "LIMIT";
type OrderUiMode = "BASIC" | "SPEED";
type MarketGroupKey = "CRYPTO" | "US_STOCKS" | "KR_STOCKS" | "US_FUTURES" | "KR_FUTURES";
type SpeedClickMode = "ONE" | "DOUBLE";
type MitExecMode = "MARKET" | "LIMIT";
type SpeedOpenOrder = {
  id: string;
  side: OrderSide;
  price: number;
  qty: number;
  ocoGroup?: string;
  ocoRole?: "TP" | "SL";
};
type SpeedFill = {
  id: string;
  at: string;
  side: OrderSide;
  symbol: string;
  price: number;
  qty: number;
  reason: "MANUAL" | "MIT" | "BOOK" | "AUTO_FILL";
  ocoRole?: "TP" | "SL";
};
type SpeedFillFilter = "ALL" | SpeedFill["reason"];
type SpeedListSort = "LATEST" | "PRICE_ASC" | "PRICE_DESC";
type SpeedPanelTab = "ORDER" | "AUTO" | "STATUS";

function speedSortLabel(s: SpeedListSort): string {
  if (s === "LATEST") return "최신순";
  if (s === "PRICE_ASC") return "가격↑";
  return "가격↓";
}

function speedFillFilterLabel(f: SpeedFillFilter): string {
  const map: Record<SpeedFillFilter, string> = {
    ALL: "전체",
    MANUAL: "수동",
    BOOK: "호가행",
    MIT: "MIT",
    AUTO_FILL: "자동체결"
  };
  return map[f];
}
type SpeedMitOrder = {
  id: string;
  side: OrderSide;
  trigger: number;
  offsetTicks: number;
  execMode: MitExecMode;
  qty: number;
};

type MarketGroupConfig = {
  label: string;
  sourceLabel: string;
  tickSize: number;
  symbols: string[];
  fetcher: "BITGET" | "YAHOO" | "MOCK";
};

function marketQtyLabel(group: MarketGroupKey): string {
  if (group === "US_FUTURES" || group === "KR_FUTURES") return "계약";
  if (group === "US_STOCKS" || group === "KR_STOCKS") return "주";
  return "수량";
}

function contractSpecForSymbol(symbol: string): { name: string; multiplier: number; unit: string } | null {
  if (symbol === "NQ=F") return { name: "Nasdaq100 E-mini", multiplier: 20, unit: "USD/pt" };
  if (symbol === "ES=F") return { name: "S&P500 E-mini", multiplier: 50, unit: "USD/pt" };
  if (symbol === "CL=F") return { name: "WTI Crude Oil", multiplier: 1000, unit: "USD/bbl" };
  return null;
}

function marketDataGrade(
  group: MarketGroupKey,
  fetcher: MarketGroupConfig["fetcher"],
  apiStatus: "CONNECTED" | "FALLBACK"
): { ticker: "LIVE" | "DELAYED" | "MOCK"; orderbook: "LIVE" | "DELAYED" | "MOCK" } {
  if (apiStatus === "FALLBACK") return { ticker: "MOCK", orderbook: "MOCK" };
  if (group === "CRYPTO" && fetcher === "BITGET") return { ticker: "LIVE", orderbook: "MOCK" };
  if ((group === "US_STOCKS" || group === "KR_STOCKS" || group === "US_FUTURES") && fetcher === "YAHOO") {
    return { ticker: "DELAYED", orderbook: "MOCK" };
  }
  return { ticker: "MOCK", orderbook: "MOCK" };
}

function dataGradeReason(grade: "LIVE" | "DELAYED" | "MOCK", kind: "ticker" | "orderbook"): string {
  if (grade === "LIVE") return `${kind} is from direct exchange/public endpoint with current polling.`;
  if (grade === "DELAYED") return `${kind} may be delayed based on upstream provider policy.`;
  return `${kind} is simulation/fallback data, not exchange depth feed.`;
}

type Tournament = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  entryFee: number;
  seedAsset: number;
  market: string;
  status: "PENDING" | "ACTIVE" | "ENDED";
};

type RankingRow = {
  user: string;
  roi: number;
  pnl: number;
  trades: number;
  winRate: number;
};

type ReferralRule = {
  id: number;
  code: string;
  level1Rate: number;
  level2Rate: number;
  enabled: boolean;
};

type AdminBranch = {
  id: number;
  name: string;
  role: string;
  parentId: number | null;
  rebateRate: number;
  active: boolean;
};

type FeePolicy = {
  spotMaker: number;
  spotTaker: number;
  futuresMaker: number;
  futuresTaker: number;
  withdrawFeeUsdt: number;
};

type KycTicket = {
  id: number;
  user: string;
  level: "BASIC" | "PRO" | "INSTITUTIONAL";
  status: "PENDING" | "APPROVED" | "REJECTED";
};

type SettlementBatch = {
  id: number;
  period: string;
  grossFeeUsdt: number;
  rebateUsdt: number;
  netRevenueUsdt: number;
  status: "READY" | "LOCKED" | "PAID";
};

type RiskRule = {
  id: number;
  name: string;
  threshold: number;
  enabled: boolean;
};

type Notice = {
  id: number;
  title: string;
  audience: "ALL" | "VIP" | "PARTNER";
  active: boolean;
};

type AdminRole = "SUPER_ADMIN" | "OPS_ADMIN" | "CS_ADMIN";
type ConfigChangeLog = {
  id: number;
  section: "FEE_POLICY" | "RISK_RULE";
  key: string;
  before: string;
  after: string;
  at: string;
  actor: string;
};

const navItems = [
  ["메인", "/"],
  ["로그인/회원가입", "/auth"],
  ["거래소", "/exchange"],
  ["현물거래", "/spot"],
  ["선물거래", "/futures"],
  ["모의투자", "/simulation"],
  ["대회", "/tournament"],
  ["랭킹", "/ranking"],
  ["지갑", "/wallet"],
  ["입출금", "/wallet/flow"],
  ["마이페이지", "/mypage"],
  ["관리자", "/admin"]
] as const;

const MARKET_GROUPS: Record<MarketGroupKey, MarketGroupConfig> = {
  CRYPTO: {
    label: "코인선물",
    sourceLabel: "Bitget USDT-M",
    tickSize: 0.1,
    symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"],
    fetcher: "BITGET"
  },
  US_STOCKS: {
    label: "해외주식",
    sourceLabel: "Yahoo Finance",
    tickSize: 0.01,
    symbols: ["AAPL", "TSLA", "NVDA", "MSFT"],
    fetcher: "YAHOO"
  },
  KR_STOCKS: {
    label: "국내주식",
    sourceLabel: "Yahoo Finance",
    tickSize: 1,
    symbols: ["005930.KS", "000660.KS", "035420.KS"],
    fetcher: "YAHOO"
  },
  US_FUTURES: {
    label: "해외선물",
    sourceLabel: "Yahoo Finance",
    tickSize: 0.25,
    symbols: ["NQ=F", "GC=F", "CL=F", "ES=F"],
    fetcher: "YAHOO"
  },
  KR_FUTURES: {
    label: "국내선물",
    sourceLabel: "Mock Engine",
    tickSize: 0.05,
    symbols: ["KOSPI200F", "USDKRWF"],
    fetcher: "MOCK"
  }
};

function symChangeKey(marketGroup: MarketGroupKey, sym: string) {
  return `${marketGroup}:${sym.trim().toUpperCase()}`;
}

/** Bitget USDT-M 심볼별 최소 호가 단위(근사). 종목 전환 시 스냅·표시 자릿수 정합용. */
const CRYPTO_SYMBOL_TICK: Partial<Record<string, number>> = {
  BTCUSDT: 0.1,
  ETHUSDT: 0.01,
  SOLUSDT: 0.01,
  XRPUSDT: 0.0001,
  DOGEUSDT: 0.00001
};

function ShellPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function App() {
  const location = useLocation();
  const [marketGroup, setMarketGroup] = useState<MarketGroupKey>("CRYPTO");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [isPractice, setIsPractice] = useState(true);
  const [liveUsdt, setLiveUsdt] = useState(1200);
  const [practiceUsdt, setPracticeUsdt] = useState(50000);
  const [price, setPrice] = useState(103245.5);
  /** 시장군+심볼별 24h 변동률(%). 라이브 티커가 오면 해당 심볼만 갱신, 나머지는 모의 보간. */
  const [symbolDayChangePct, setSymbolDayChangePct] = useState<Record<string, number>>({});
  const [apiStatus, setApiStatus] = useState<"CONNECTED" | "FALLBACK">("FALLBACK");
  const [cryptoDepthLive, setCryptoDepthLive] = useState(false);
  const [cryptoFundingPct, setCryptoFundingPct] = useState<number | null>(null);
  const [cryptoMarkPrice, setCryptoMarkPrice] = useState<number | null>(null);
  const [cryptoDepthFromWs, setCryptoDepthFromWs] = useState(false);
  const cryptoBookWsActive = useRef(false);
  const [exchangePublicHalted, setExchangePublicHalted] = useState(false);
  const [exchangePublicDisabled, setExchangePublicDisabled] = useState<string[]>([]);
  const [adminExchangeHalted, setAdminExchangeHalted] = useState(false);
  const [adminExchangeDisabled, setAdminExchangeDisabled] = useState<string[]>([]);
  const [adminSymbolToggle, setAdminSymbolToggle] = useState("BTCUSDT");
  const [adminSimMidPrice, setAdminSimMidPrice] = useState("97000");
  const [exchangeSimMids, setExchangeSimMids] = useState<Record<string, number>>({});
  /** Bitget 전종목 티커에서 온 USDT-M 현재가(레일 표시). */
  const [cryptoTickerMids, setCryptoTickerMids] = useState<Record<string, number>>({});
  const [pendingCancelOrderId, setPendingCancelOrderId] = useState("");
  const [qty, setQty] = useState(0.01);
  const [leverage, setLeverage] = useState(5);
  const [side, setSide] = useState<OrderSide>("LONG");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [orderUiMode, setOrderUiMode] = useState<OrderUiMode>("SPEED");
  const [limitPrice, setLimitPrice] = useState(price);
  const [positions, setPositions] = useState<string[]>([]);
  const [orders, setOrders] = useState<string[]>([]);
  const [trades, setTrades] = useState<string[]>([]);
  const [lastEntryPrice, setLastEntryPrice] = useState<number | null>(null);
  const [lastEntrySide, setLastEntrySide] = useState<OrderSide>("LONG");
  const [uiError, setUiError] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([
    {
      id: 1,
      name: "May ROI Sprint",
      startDate: "2026-05-12",
      endDate: "2026-05-19",
      entryFee: 20,
      seedAsset: 1000,
      market: "BTCUSDT, ETHUSDT",
      status: "PENDING"
    }
  ]);
  const [ranking] = useState<RankingRow[]>([
    { user: "trader_neo", roi: 82.4, pnl: 824, trades: 33, winRate: 63.6 },
    { user: "alpha_min", roi: 71.2, pnl: 712, trades: 28, winRate: 57.1 },
    { user: "kim_quant", roi: 55.9, pnl: 559, trades: 19, winRate: 68.4 }
  ]);
  const [referralRules, setReferralRules] = useState<ReferralRule[]>([
    { id: 1, code: "WELCOME10", level1Rate: 20, level2Rate: 5, enabled: true },
    { id: 2, code: "PROAFF", level1Rate: 25, level2Rate: 8, enabled: true }
  ]);
  const [adminBranches, setAdminBranches] = useState<AdminBranch[]>([
    { id: 1, name: "Tetherget HQ", role: "본사", parentId: null, rebateRate: 30, active: true },
    { id: 2, name: "Korea Regional", role: "지사", parentId: 1, rebateRate: 20, active: true },
    { id: 3, name: "Seoul Team A", role: "하부조직", parentId: 2, rebateRate: 10, active: true }
  ]);
  const [feePolicy, setFeePolicy] = useState<FeePolicy>({
    spotMaker: 0.08,
    spotTaker: 0.1,
    futuresMaker: 0.02,
    futuresTaker: 0.05,
    withdrawFeeUsdt: 1
  });
  const [kycTickets, setKycTickets] = useState<KycTicket[]>([
    { id: 1, user: "neo_trader", level: "PRO", status: "PENDING" },
    { id: 2, user: "desk_alpha", level: "INSTITUTIONAL", status: "PENDING" }
  ]);
  const [settlementBatches, setSettlementBatches] = useState<SettlementBatch[]>([
    {
      id: 20260501,
      period: "2026-05 Week1",
      grossFeeUsdt: 48322,
      rebateUsdt: 10212,
      netRevenueUsdt: 38110,
      status: "READY"
    }
  ]);
  const [riskRules, setRiskRules] = useState<RiskRule[]>([
    { id: 1, name: "고위험 단일계정 레버리지", threshold: 50, enabled: true },
    { id: 2, name: "이상 출금 모니터링", threshold: 100000, enabled: true },
    { id: 3, name: "급격한 포지션 집중도", threshold: 70, enabled: true }
  ]);
  const [notices, setNotices] = useState<Notice[]>([
    { id: 1, title: "테더켓 거래소 정기 점검 안내", audience: "ALL", active: true }
  ]);
  const [adminRole, setAdminRole] = useState<AdminRole>("SUPER_ADMIN");
  const [auditLogs, setAuditLogs] = useState<string[]>(["SYSTEM: platform booted"]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [authEmail, setAuthEmail] = useState("super@tetherget.io");
  const [authPassword, setAuthPassword] = useState("pass1234");
  const [authUser, setAuthUser] = useState<{ id: number; email: string; role: ApiRole } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [sessionExpireAt, setSessionExpireAt] = useState<number | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<"ALL" | ApiOrderStatus>("ALL");
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderStartDate, setOrderStartDate] = useState("");
  const [orderEndDate, setOrderEndDate] = useState("");
  const [configChangeLogs, setConfigChangeLogs] = useState<ConfigChangeLog[]>([]);
  const [adminActionLogs, setAdminActionLogs] = useState<
    Array<{
      id: number;
      at: string;
      actor: string;
      action: string;
      details?: string;
      before?: string;
      after?: string;
      correlationId?: string;
    }>
  >([]);
  const [alerts, setAlerts] = useState<Array<{ id: number; level: "INFO" | "WARN" | "CRITICAL"; message: string; at: string }>>([]);
  const [withdrawals, setWithdrawals] = useState<
    Array<{ id: number; userId: number; amount: number; address: string; status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string }>
  >([]);
  const [withdrawAmount, setWithdrawAmount] = useState(100);
  const [withdrawAddress, setWithdrawAddress] = useState("TETH-EXAMPLE-WALLET-ADDR-001");
  const [otpCode, setOtpCode] = useState("123456");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpExpireAt, setOtpExpireAt] = useState<number | null>(null);
  const [orderBook, setOrderBook] = useState(
    Array.from({ length: 8 }, (_, i) => ({
      ask: Number((price + i * 6.5).toFixed(2)),
      askQty: Number((Math.random() * 2 + 0.1).toFixed(4)),
      bid: Number((price - i * 6.5).toFixed(2)),
      bidQty: Number((Math.random() * 2 + 0.1).toFixed(4))
    }))
  );
  const [speedQty, setSpeedQty] = useState(0.01);
  const [speedPrice, setSpeedPrice] = useState(price);
  const [speedConfirmOrder, setSpeedConfirmOrder] = useState(false);
  const [speedBookClickMode, setSpeedBookClickMode] = useState<SpeedClickMode>("ONE");
  const [speedPendingBookKey, setSpeedPendingBookKey] = useState<string | null>(null);
  const [speedOpenOrders, setSpeedOpenOrders] = useState<SpeedOpenOrder[]>([]);
  const [speedMultiTicks, setSpeedMultiTicks] = useState(2);
  const [speedMultiCount, setSpeedMultiCount] = useState(3);
  const [speedMitEnabled, setSpeedMitEnabled] = useState(false);
  const [speedMitTrigger, setSpeedMitTrigger] = useState(price);
  const [speedMitOffsetTicks, setSpeedMitOffsetTicks] = useState(1);
  const [speedMitExecMode, setSpeedMitExecMode] = useState<MitExecMode>("MARKET");
  const [speedMitOrders, setSpeedMitOrders] = useState<SpeedMitOrder[]>([]);
  const [speedUseOco, setSpeedUseOco] = useState(false);
  const [speedTpTicks, setSpeedTpTicks] = useState(12);
  const [speedSlTicks, setSpeedSlTicks] = useState(8);
  const [speedFills, setSpeedFills] = useState<SpeedFill[]>([]);
  const [speedBottomTab, setSpeedBottomTab] = useState<"OPEN" | "FILLS">("OPEN");
  const [speedFillFilter, setSpeedFillFilter] = useState<SpeedFillFilter>("ALL");
  const [speedOpenSort, setSpeedOpenSort] = useState<SpeedListSort>("LATEST");
  const [speedMitSort, setSpeedMitSort] = useState<SpeedListSort>("LATEST");
  const [speedFillSort, setSpeedFillSort] = useState<SpeedListSort>("LATEST");
  const [speedToggleConfirm, setSpeedToggleConfirm] = useState(false);
  const [speedPanelTab, setSpeedPanelTab] = useState<SpeedPanelTab>("ORDER");
  const [speedSummaryCollapsed, setSpeedSummaryCollapsed] = useState(false);
  const [speedFillSearch, setSpeedFillSearch] = useState("");
  const [speedOpenWarnThreshold, setSpeedOpenWarnThreshold] = useState(10);
  const [speedMitWarnThreshold, setSpeedMitWarnThreshold] = useState(5);
  const [speedEventNotice, setSpeedEventNotice] = useState("");
  const [marketLiveVolume, setMarketLiveVolume] = useState<number | null>(null);
  const notifySpeedEvent = (message: string) => {
    setSpeedEventNotice(message);
    window.setTimeout(() => {
      setSpeedEventNotice((prev) => (prev === message ? "" : prev));
    }, 2500);
  };
  const formatKst = (iso: string) => {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(d);
  };
  const marketCfg = MARKET_GROUPS[marketGroup];
  const tickSize = useMemo(() => {
    if (marketGroup !== "CRYPTO") return marketCfg.tickSize;
    const k = symbol.trim().toUpperCase();
    return CRYPTO_SYMBOL_TICK[k] ?? marketCfg.tickSize;
  }, [marketGroup, marketCfg.tickSize, symbol]);
  const marketChange = symbolDayChangePct[symChangeKey(marketGroup, symbol)] ?? 0;
  const qtyLabel = marketQtyLabel(marketGroup);
  const symbolContractSpec = contractSpecForSymbol(symbol);
  const dataGrade = useMemo(() => {
    const base = marketDataGrade(marketGroup, marketCfg.fetcher, apiStatus);
    if (
      apiStatus === "CONNECTED" &&
      marketGroup === "CRYPTO" &&
      marketCfg.fetcher === "BITGET" &&
      cryptoDepthLive
    ) {
      return { ...base, orderbook: "LIVE" as const };
    }
    return base;
  }, [apiStatus, cryptoDepthLive, marketCfg.fetcher, marketGroup]);
  const tickerGradeReason = dataGradeReason(dataGrade.ticker, "ticker");
  const bookGradeReason = useMemo(() => {
    if (dataGrade.orderbook === "LIVE" && marketGroup === "CRYPTO" && cryptoDepthLive) {
      return cryptoDepthFromWs
        ? "Orderbook: Bitget USDT-M depth via WebSocket channel books15 (~150ms snapshots)."
        : "Orderbook: Bitget USDT-M REST snapshot (WebSocket unavailable or between reconnects).";
    }
    return dataGradeReason(dataGrade.orderbook, "orderbook");
  }, [cryptoDepthFromWs, cryptoDepthLive, dataGrade.orderbook, marketGroup]);
  const isFuturesGroup = marketGroup === "US_FUTURES" || marketGroup === "KR_FUTURES";
  const isStockGroup = marketGroup === "US_STOCKS" || marketGroup === "KR_STOCKS";
  const isCryptoGroup = marketGroup === "CRYPTO";
  const formatBookQty = (v: number) => {
    if (isFuturesGroup || isStockGroup) {
      return Math.round(v).toLocaleString();
    }
    return Number(v).toFixed(4);
  };
  const decimals = priceDecimalsForTick(tickSize);
  const snapPrice = (v: number) => Number((Math.round(v / tickSize) * tickSize).toFixed(decimals));

  useEffect(() => {
    if (marketGroup !== "CRYPTO") return;
    const dec = priceDecimalsForTick(tickSize);
    const snap = (v: number) => Number((Math.round(v / tickSize) * tickSize).toFixed(dec));
    setLimitPrice((p) => snap(p));
    setSpeedPrice((p) => snap(p));
    setSpeedMitTrigger((t) => snap(t));
  }, [symbol, tickSize, marketGroup]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tgx.speed.state");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        orderUiMode?: OrderUiMode;
        speedQty?: number;
        speedPrice?: number;
        speedConfirmOrder?: boolean;
        speedBookClickMode?: SpeedClickMode;
        speedOpenOrders?: SpeedOpenOrder[];
        speedMultiTicks?: number;
        speedMultiCount?: number;
        speedMitEnabled?: boolean;
        speedMitTrigger?: number;
        speedMitOffsetTicks?: number;
        speedMitExecMode?: MitExecMode;
        speedMitOrders?: SpeedMitOrder[];
        speedUseOco?: boolean;
        speedTpTicks?: number;
        speedSlTicks?: number;
        speedFills?: SpeedFill[];
        speedBottomTab?: "OPEN" | "FILLS";
        speedFillFilter?: SpeedFillFilter;
        speedOpenSort?: SpeedListSort;
        speedMitSort?: SpeedListSort;
        speedFillSort?: SpeedListSort;
        speedToggleConfirm?: boolean;
        speedPanelTab?: SpeedPanelTab;
        speedSummaryCollapsed?: boolean;
        speedFillSearch?: string;
        speedOpenWarnThreshold?: number;
        speedMitWarnThreshold?: number;
      };
      if (parsed.orderUiMode) setOrderUiMode(parsed.orderUiMode);
      if (Number.isFinite(parsed.speedQty)) setSpeedQty(Number(parsed.speedQty));
      if (Number.isFinite(parsed.speedPrice)) setSpeedPrice(Number(parsed.speedPrice));
      if (typeof parsed.speedConfirmOrder === "boolean") setSpeedConfirmOrder(parsed.speedConfirmOrder);
      if (parsed.speedBookClickMode) setSpeedBookClickMode(parsed.speedBookClickMode);
      if (Array.isArray(parsed.speedOpenOrders)) setSpeedOpenOrders(parsed.speedOpenOrders);
      if (Number.isFinite(parsed.speedMultiTicks)) setSpeedMultiTicks(Number(parsed.speedMultiTicks));
      if (Number.isFinite(parsed.speedMultiCount)) setSpeedMultiCount(Number(parsed.speedMultiCount));
      if (typeof parsed.speedMitEnabled === "boolean") setSpeedMitEnabled(parsed.speedMitEnabled);
      if (Number.isFinite(parsed.speedMitTrigger)) setSpeedMitTrigger(Number(parsed.speedMitTrigger));
      if (Number.isFinite(parsed.speedMitOffsetTicks)) setSpeedMitOffsetTicks(Number(parsed.speedMitOffsetTicks));
      if (parsed.speedMitExecMode) setSpeedMitExecMode(parsed.speedMitExecMode);
      if (Array.isArray(parsed.speedMitOrders)) setSpeedMitOrders(parsed.speedMitOrders);
      if (typeof parsed.speedUseOco === "boolean") setSpeedUseOco(parsed.speedUseOco);
      if (Number.isFinite(parsed.speedTpTicks)) setSpeedTpTicks(Number(parsed.speedTpTicks));
      if (Number.isFinite(parsed.speedSlTicks)) setSpeedSlTicks(Number(parsed.speedSlTicks));
      if (Array.isArray(parsed.speedFills)) setSpeedFills(parsed.speedFills);
      if (parsed.speedBottomTab) setSpeedBottomTab(parsed.speedBottomTab);
      if (parsed.speedFillFilter) setSpeedFillFilter(parsed.speedFillFilter);
      if (parsed.speedOpenSort) setSpeedOpenSort(parsed.speedOpenSort);
      if (parsed.speedMitSort) setSpeedMitSort(parsed.speedMitSort);
      if (parsed.speedFillSort) setSpeedFillSort(parsed.speedFillSort);
      if (typeof parsed.speedToggleConfirm === "boolean") setSpeedToggleConfirm(parsed.speedToggleConfirm);
      if (parsed.speedPanelTab) setSpeedPanelTab(parsed.speedPanelTab);
      if (typeof parsed.speedSummaryCollapsed === "boolean") setSpeedSummaryCollapsed(parsed.speedSummaryCollapsed);
      if (typeof parsed.speedFillSearch === "string") setSpeedFillSearch(parsed.speedFillSearch);
      if (Number.isFinite(parsed.speedOpenWarnThreshold)) setSpeedOpenWarnThreshold(Number(parsed.speedOpenWarnThreshold));
      if (Number.isFinite(parsed.speedMitWarnThreshold)) setSpeedMitWarnThreshold(Number(parsed.speedMitWarnThreshold));
    } catch {
      // Ignore invalid localStorage payload and continue with defaults.
    }
  }, []);

  useEffect(() => {
    const payload = {
      orderUiMode,
      speedQty,
      speedPrice,
      speedConfirmOrder,
      speedBookClickMode,
      speedOpenOrders,
      speedMultiTicks,
      speedMultiCount,
      speedMitEnabled,
      speedMitTrigger,
      speedMitOffsetTicks,
      speedMitExecMode,
      speedMitOrders,
      speedUseOco,
      speedTpTicks,
      speedSlTicks,
      speedFills,
      speedBottomTab,
      speedFillFilter,
      speedOpenSort,
      speedMitSort,
      speedFillSort,
      speedToggleConfirm,
      speedPanelTab,
      speedSummaryCollapsed,
      speedFillSearch,
      speedOpenWarnThreshold,
      speedMitWarnThreshold
    };
    localStorage.setItem("tgx.speed.state", JSON.stringify(payload));
  }, [
    orderUiMode,
    speedQty,
    speedPrice,
    speedConfirmOrder,
    speedBookClickMode,
    speedOpenOrders,
    speedMultiTicks,
    speedMultiCount,
    speedMitEnabled,
    speedMitTrigger,
    speedMitOffsetTicks,
    speedMitExecMode,
    speedMitOrders,
    speedUseOco,
    speedTpTicks,
    speedSlTicks,
    speedFills,
    speedBottomTab,
    speedFillFilter,
    speedOpenSort,
    speedMitSort,
    speedFillSort,
    speedToggleConfirm,
    speedPanelTab,
    speedSummaryCollapsed,
    speedFillSearch,
    speedOpenWarnThreshold,
    speedMitWarnThreshold
  ]);

  useEffect(() => {
    setSymbol((prev) => (marketCfg.symbols.includes(prev) ? prev : marketCfg.symbols[0]));
  }, [marketCfg.symbols]);
  useEffect(() => {
    if (marketGroup !== "CRYPTO") {
      setCryptoDepthLive(false);
      setCryptoFundingPct(null);
      setCryptoMarkPrice(null);
      setCryptoDepthFromWs(false);
      cryptoBookWsActive.current = false;
    }
  }, [marketGroup]);

  useEffect(() => {
    if (location.pathname !== "/spot") return;
    setMarketGroup((mg) => (mg === "US_FUTURES" || mg === "KR_FUTURES" ? "CRYPTO" : mg));
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/exchange") return;
    getExchangePublicStatus()
      .then((s) => {
        setExchangePublicHalted(s.halted);
        setExchangePublicDisabled(s.disabledSymbols);
        if (s.simMidPrices) setExchangeSimMids(s.simMidPrices);
      })
      .catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    if (marketGroup !== "CRYPTO" || marketCfg.fetcher !== "BITGET") {
      cryptoBookWsActive.current = false;
      setCryptoDepthFromWs(false);
      return;
    }

    cryptoBookWsActive.current = false;

    const unsubscribe = subscribeBitgetMixBooks15({
      symbol,
      ladderRows: 8,
      callbacks: {
        onRows: (rows) => {
          cryptoBookWsActive.current = true;
          setCryptoDepthFromWs(true);
          setOrderBook(rows);
          setCryptoDepthLive(true);
        },
        onSocketInactive: () => {
          cryptoBookWsActive.current = false;
          setCryptoDepthFromWs(false);
        }
      }
    });

    return unsubscribe;
  }, [marketGroup, marketCfg.fetcher, symbol]);
  useEffect(() => {
    if (marketGroup === "US_FUTURES") {
      setQty((v) => Math.max(1, Math.round(v || 1)));
      setSpeedQty((v) => Math.max(1, Math.round(v || 1)));
    }
  }, [marketGroup]);

  useEffect(() => {
    let mounted = true;
    let mockPrice = price;
    const buildBook = (center: number) => {
      const isFutures = marketGroup === "US_FUTURES" || marketGroup === "KR_FUTURES";
      const isStocks = marketGroup === "US_STOCKS" || marketGroup === "KR_STOCKS";
      return Array.from({ length: 8 }, (_, i) => {
        const askQtyRaw = isFutures ? Math.random() * 90 + 10 : isStocks ? Math.random() * 8000 + 500 : Math.random() * 2 + 0.1;
        const bidQtyRaw = isFutures ? Math.random() * 90 + 10 : isStocks ? Math.random() * 8000 + 500 : Math.random() * 2 + 0.1;
        return {
          ask: snapPrice(center + (i + 1) * tickSize),
          askQty: isFutures ? Math.round(askQtyRaw) : Number(askQtyRaw.toFixed(isStocks ? 0 : 4)),
          bid: snapPrice(Math.max(tickSize, center - (i + 1) * tickSize)),
          bidQty: isFutures ? Math.round(bidQtyRaw) : Number(bidQtyRaw.toFixed(isStocks ? 0 : 4))
        };
      });
    };
    const getOrderBookData = async (
      center: number,
      allowLiveDepth: boolean
    ): Promise<{ rows: Array<{ ask: number; askQty: number; bid: number; bidQty: number }>; depthLive: boolean }> => {
      if (allowLiveDepth && marketGroup === "CRYPTO" && marketCfg.fetcher === "BITGET") {
        try {
          const rows = await fetchBitgetMixUsdtOrderBook(symbol, 8);
          return { rows, depthLive: true };
        } catch {
          return { rows: buildBook(center), depthLive: false };
        }
      }
      return { rows: buildBook(center), depthLive: false };
    };

    const pullMarket = async () => {
      try {
        if (marketCfg.fetcher === "BITGET") {
          const map = await fetchBitgetMixUsdtAllTickers();
          const symKey = symbol.trim().toUpperCase();
          const ticker = map.get(symKey);
          if (!ticker) throw new Error("bitget ticker missing symbol");
          const nextPrice = snapPrice(ticker.lastPr);
          const mpRaw = ticker.markPrice != null ? snapPrice(ticker.markPrice) : NaN;
          const volRaw = ticker.baseVolume;
          const frRaw = ticker.fundingRatePct;
          if (mounted && Number.isFinite(nextPrice)) {
            setCryptoTickerMids((prev) => {
              const next = { ...prev };
              for (const s of marketCfg.symbols) {
                const row = map.get(s.trim().toUpperCase());
                if (row) next[s.trim().toUpperCase()] = row.lastPr;
              }
              return next;
            });
            setSymbolDayChangePct((prev) => {
              const next = { ...prev };
              for (const s of marketCfg.symbols) {
                const row = map.get(s.trim().toUpperCase());
                if (row) next[symChangeKey(marketGroup, s)] = row.change24hPct;
              }
              return next;
            });
            setPrice(nextPrice);
            setLimitPrice(nextPrice);
            setSpeedPrice(nextPrice);
            setCryptoFundingPct(frRaw);
            setCryptoMarkPrice(Number.isFinite(mpRaw) ? mpRaw : null);
            setMarketLiveVolume(volRaw);
            if (!cryptoBookWsActive.current) {
              const book = await getOrderBookData(nextPrice, true);
              setOrderBook(book.rows);
              setCryptoDepthLive(book.depthLive);
              setCryptoDepthFromWs(false);
            }
            setApiStatus("CONNECTED");
          }
          return;
        }

        if (marketCfg.fetcher === "YAHOO") {
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`);
          if (!res.ok) throw new Error("yahoo failed");
          const data = (await res.json()) as {
            chart?: {
              result?: Array<{
                meta?: { regularMarketPrice?: number; chartPreviousClose?: number; regularMarketVolume?: number };
              }>;
            };
          };
          const meta = data.chart?.result?.[0]?.meta;
          const nextPrice = snapPrice(Number(meta?.regularMarketPrice ?? mockPrice));
          const prevClose = Number(meta?.chartPreviousClose ?? nextPrice);
          const nextChange = prevClose > 0 ? ((nextPrice - prevClose) / prevClose) * 100 : 0;
          if (mounted && Number.isFinite(nextPrice)) {
            setPrice(nextPrice);
            setSymbolDayChangePct((p) => ({
              ...p,
              [symChangeKey(marketGroup, symbol)]: nextChange
            }));
            setLimitPrice(nextPrice);
            setSpeedPrice(nextPrice);
            const book = await getOrderBookData(nextPrice, false);
            setOrderBook(book.rows);
            setMarketLiveVolume(Number.isFinite(meta?.regularMarketVolume) ? Number(meta?.regularMarketVolume) : null);
            setApiStatus("CONNECTED");
          }
          return;
        }

        throw new Error("mock mode");
      } catch {
        mockPrice = snapPrice(Math.max(tickSize, mockPrice + (Math.random() - 0.5) * mockPrice * 0.003));
        if (mounted) {
          setPrice(mockPrice);
          setSymbolDayChangePct((p) => ({
            ...p,
            [symChangeKey(marketGroup, symbol)]: (Math.random() - 0.5) * 2
          }));
          setLimitPrice(mockPrice);
          setSpeedPrice(mockPrice);
          const keepWsBook =
            marketGroup === "CRYPTO" && marketCfg.fetcher === "BITGET" && cryptoBookWsActive.current;
          if (!keepWsBook) {
            const book = await getOrderBookData(mockPrice, false);
            setOrderBook(book.rows);
            setCryptoDepthFromWs(false);
          }
          setCryptoDepthLive(false);
          setCryptoFundingPct(null);
          setCryptoMarkPrice(null);
          setMarketLiveVolume(null);
          setApiStatus("FALLBACK");
        }
      }
    };

    pullMarket();
    const id = window.setInterval(pullMarket, 4000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [marketCfg.fetcher, marketCfg.symbols, marketGroup, symbol, tickSize]);

  useEffect(() => {
    setSymbolDayChangePct((prev) => {
      const next = { ...prev };
      for (const s of marketCfg.symbols) {
        const k = symChangeKey(marketGroup, s);
        if (next[k] === undefined) {
          next[k] = (Math.random() - 0.5) * 6;
        }
      }
      return next;
    });
  }, [marketGroup, marketCfg.symbols]);

  useEffect(() => {
    if (marketGroup === "CRYPTO" && marketCfg.fetcher === "BITGET") {
      return () => {};
    }
    const id = window.setInterval(() => {
      setSymbolDayChangePct((prev) => {
        const next = { ...prev };
        for (const s of marketCfg.symbols) {
          if (s === symbol) continue;
          const k = symChangeKey(marketGroup, s);
          const cur = next[k];
          if (cur === undefined) continue;
          next[k] = Math.max(-15, Math.min(15, cur + (Math.random() - 0.5) * 0.9));
        }
        return next;
      });
    }, 8000);
    return () => window.clearInterval(id);
  }, [marketGroup, marketCfg.fetcher, marketCfg.symbols, symbol]);

  useEffect(() => {
    if (marketGroup !== "CRYPTO" || marketCfg.fetcher !== "BITGET") {
      setCryptoTickerMids({});
    }
  }, [marketGroup, marketCfg.fetcher]);

  useEffect(() => {
    const raw = localStorage.getItem("tetherget-session");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        token: string;
        user: { id: number; email: string; role: ApiRole };
        expireAt?: number;
      };
      setAuthToken(parsed.token);
      setAuthUser(parsed.user);
      setSessionExpireAt(parsed.expireAt ?? null);
      if (parsed.user.role !== "TRADER") {
        setAdminRole(parsed.user.role as AdminRole);
      }
    } catch {
      localStorage.removeItem("tetherget-session");
    }
  }, []);

  useEffect(() => {
    if (!sessionExpireAt) return;
    const id = window.setInterval(() => {
      if (Date.now() > sessionExpireAt) {
        setAuthUser(null);
        setAuthToken(null);
        setSessionExpireAt(null);
        localStorage.removeItem("tetherget-session");
        setUiError("세션이 만료되어 로그아웃되었습니다. 다시 로그인해 주세요.");
      }
    }, 15000);
    return () => window.clearInterval(id);
  }, [sessionExpireAt]);

  useEffect(() => {
    if (!authUser) return;
    if (authUser.role === "SUPER_ADMIN" || authUser.role === "OPS_ADMIN") {
      getAdminSettlement(authUser.role, authToken ?? undefined)
        .then((data) => {
          setSettlementBatches(data.items);
          setBackendConnected(true);
        })
        .catch(() => {
          setBackendConnected(false);
        });
    }
    if (authUser.role !== "TRADER") {
      getAdminAudit(authUser.role, authToken ?? undefined)
        .then((data) => {
          setAuditLogs(data.items.slice(0, 30));
          setBackendConnected(true);
        })
        .catch(() => {
          setBackendConnected(false);
        });
      getAdminActionLogs(authUser.role, authToken ?? undefined)
        .then((data) => setAdminActionLogs(data.items.slice(0, 50)))
        .catch(() => {
          setBackendConnected(false);
        });
      getAdminAlerts(authUser.role, authToken ?? undefined)
        .then((data) => setAlerts(data.items.slice(0, 10)))
        .catch(() => {
          setBackendConnected(false);
        });
    }
    if (authUser.role === "SUPER_ADMIN" || authUser.role === "OPS_ADMIN") {
      getAdminWithdrawals(authUser.role, authToken ?? undefined)
        .then((data) => setWithdrawals(data.items))
        .catch(() => {
          setBackendConnected(false);
        });
    }
    if (authUser.role === "SUPER_ADMIN" || authUser.role === "CS_ADMIN") {
      getAdminKyc(authUser.role, authToken ?? undefined)
        .then((data) => setKycTickets(data.items))
        .catch(() => {
          setBackendConnected(false);
        });
    }
    getWallet(authUser.id, authToken ?? undefined)
      .then((wallet) => {
        setLiveUsdt(wallet.usdt);
        setBackendConnected(true);
      })
      .catch(() => {
        setBackendConnected(false);
      });
  }, [authToken, authUser]);

  useEffect(() => {
    if (!authUser || location.pathname !== "/admin") return;
    const id = window.setInterval(() => {
      if (authUser.role !== "TRADER") {
        getAdminAudit(authUser.role, authToken ?? undefined).then((data) => setAuditLogs(data.items.slice(0, 30)));
        getAdminActionLogs(authUser.role, authToken ?? undefined).then((data) =>
          setAdminActionLogs(data.items.slice(0, 50))
        );
        getAdminAlerts(authUser.role, authToken ?? undefined).then((data) => setAlerts(data.items.slice(0, 10)));
      }
      if (authUser.role === "SUPER_ADMIN" || authUser.role === "OPS_ADMIN") {
        getAdminSettlement(authUser.role, authToken ?? undefined).then((data) => setSettlementBatches(data.items));
        getAdminWithdrawals(authUser.role, authToken ?? undefined).then((data) => setWithdrawals(data.items));
      }
      if (authUser.role === "SUPER_ADMIN" || authUser.role === "CS_ADMIN") {
        getAdminKyc(authUser.role, authToken ?? undefined).then((data) => setKycTickets(data.items));
      }
    }, 12000);
    return () => window.clearInterval(id);
  }, [authToken, authUser, location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (orderUiMode !== "SPEED") return;
      if (e.key === "F1") {
        e.preventDefault();
        setSide("SHORT");
        submitOrder();
      } else if (e.key === "F2") {
        e.preventDefault();
        setSide("LONG");
        submitOrder();
      } else if (e.key === "Enter" && (location.pathname === "/spot" || location.pathname === "/futures" || location.pathname === "/simulation")) {
        e.preventDefault();
        submitOrder();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location.pathname, orderUiMode, submitOrder]);

  useEffect(() => {
    if (!speedMitEnabled || orderUiMode !== "SPEED" || speedMitOrders.length === 0) return;
    const remaining: typeof speedMitOrders = [];
    const triggered: typeof speedMitOrders = [];
    for (const m of speedMitOrders) {
      const hit = m.side === "LONG" ? price >= m.trigger : price <= m.trigger;
      if (hit) triggered.push(m);
      else remaining.push(m);
    }
    if (triggered.length === 0) return;
    setSpeedMitOrders(remaining);
    triggered.forEach((m) => {
      const offset = m.offsetTicks * tickSize;
      const execPx = m.side === "LONG" ? price + offset : price - offset;
      submitOrder({
        side: m.side,
        orderType: m.execMode === "MARKET" ? "MARKET" : "LIMIT",
        qty: m.qty,
        price: snapPrice(Math.max(tickSize, execPx)),
        reason: "MIT"
      });
    });
  }, [orderUiMode, price, snapPrice, speedMitEnabled, speedMitOrders, submitOrder, tickSize]);

  useEffect(() => {
    if (orderUiMode !== "SPEED" || speedOpenOrders.length === 0) return;
    const filled: SpeedOpenOrder[] = [];
    const resting: SpeedOpenOrder[] = [];
    for (const o of speedOpenOrders) {
      const hit = o.side === "LONG" ? price <= o.price : price >= o.price;
      if (hit) filled.push(o);
      else resting.push(o);
    }
    if (filled.length === 0) return;
    const canceledGroups = new Set(
      filled
        .filter((o) => o.ocoGroup)
        .map((o) => o.ocoGroup as string)
    );
    const canceledOcoCount = resting.filter((o) => o.ocoGroup && canceledGroups.has(o.ocoGroup)).length;
    setSpeedOpenOrders(
      resting.filter((o) => !(o.ocoGroup && canceledGroups.has(o.ocoGroup)))
    );
    filled.forEach((o) => {
      const fill: SpeedFill = {
        id: `${Date.now()}-${Math.random()}`,
        at: new Date().toISOString(),
        side: o.side,
        symbol,
        price: o.price,
        qty: o.qty,
        reason: "AUTO_FILL",
        ocoRole: o.ocoRole
      };
      setSpeedFills((prev) => [fill, ...prev].slice(0, 50));
      setTrades((prev) => [`TRADE_FILLED: ${o.side} ${o.qty} ${symbol} @ ${o.price}`, ...prev].slice(0, 20));
      setAuditLogs((prev) => [`SPEED_FILL: ${o.side} ${o.qty} ${symbol} @ ${o.price}`, ...prev].slice(0, 30));
    });
    if (canceledOcoCount > 0) {
      notifySpeedEvent(`${filled.length}건 체결 / OCO 반대주문 ${canceledOcoCount}건 자동취소`);
    } else {
      notifySpeedEvent(`${filled.length}건 체결됨 (AUTO_FILL)`);
    }
  }, [orderUiMode, price, speedOpenOrders, symbol]);

  const activeBalance = isPractice ? practiceUsdt : liveUsdt;

  const estimatedCost = useMemo(() => {
    const p = orderType === "MARKET" ? price : limitPrice;
    const q = orderUiMode === "SPEED" ? speedQty : qty;
    return (p * q) / leverage;
  }, [orderType, price, limitPrice, qty, leverage, orderUiMode, speedQty]);

  const handleLogin = async () => {
    try {
      const data = await login(authEmail, authPassword);
      const expireAt = Date.now() + 1000 * 60 * 60;
      setAuthUser(data.user);
      setAuthToken(data.token);
      setSessionExpireAt(expireAt);
      localStorage.setItem("tetherget-session", JSON.stringify({ token: data.token, user: data.user, expireAt }));
      if (data.user.role !== "TRADER") {
        setAdminRole(data.user.role as AdminRole);
      }
      setAuditLogs((prev) => [`AUTH_LOGIN_UI: ${data.user.email}`, ...prev].slice(0, 30));
      setUiError(null);
      setBackendConnected(true);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("AUTH_ERROR:")) {
        handleAuthError();
        return;
      }
      setUiError("백엔드 로그인에 실패했습니다. 서버 실행 상태를 확인하세요.");
      setBackendConnected(false);
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    setAuthToken(null);
    setSessionExpireAt(null);
    localStorage.removeItem("tetherget-session");
  };

  const handleAuthError = () => {
    handleLogout();
    setOtpToken(null);
    setOtpExpireAt(null);
    setUiError("인증이 만료되었거나 권한이 없습니다. 다시 로그인해 주세요.");
    setBackendConnected(false);
  };

  const submitWithdrawal = async () => {
    if (!authUser) {
      setUiError("출금 요청은 로그인 후 가능합니다.");
      return;
    }
    try {
      const row = await createWithdrawal(
        { userId: authUser.id, amount: withdrawAmount, address: withdrawAddress },
        authToken ?? undefined
      );
      setAuditLogs((prev) => [`WITHDRAWAL_REQUESTED: id=${row.id} amount=${row.amount}`, ...prev].slice(0, 30));
      setUiError(null);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("AUTH_ERROR:")) {
        handleAuthError();
        return;
      }
      setUiError("출금 요청 실패");
    }
  };

  const decideWithdrawal = async (id: number, decision: "APPROVED" | "REJECTED") => {
    if (!authUser) return;
    if (!otpToken || (otpExpireAt !== null && Date.now() > otpExpireAt)) {
      setUiError("출금 승인/거절 전 OTP 인증이 필요합니다.");
      return;
    }
    try {
      const next = await decideAdminWithdrawal(authUser.role, id, decision, authToken ?? undefined, otpToken);
      setWithdrawals((prev) => prev.map((w) => (w.id === id ? next : w)));
      setUiError(null);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("AUTH_ERROR:")) {
        handleAuthError();
        return;
      }
      setUiError("출금 승인 처리 실패");
    }
  };

  const verifyOtpForAdmin = async () => {
    if (!authUser) {
      setUiError("OTP 인증은 로그인 후 가능합니다.");
      return;
    }
    try {
      const res = await verifyAdminOtp(authUser.role, otpCode, authToken ?? undefined);
      setOtpToken(res.otpToken);
      setOtpExpireAt(Date.now() + res.expiresInSec * 1000);
      setUiError(null);
      setAuditLogs((prev) => [`OTP_VERIFIED_UI: ${authUser.email}`, ...prev].slice(0, 30));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("AUTH_ERROR:")) {
        handleAuthError();
        return;
      }
      setUiError("OTP 인증 실패");
    }
  };

  const syncOrdersFromBackend = async () => {
    try {
      const data = await getOrders(
        {
        userId: authUser?.id,
        status: orderStatusFilter === "ALL" ? undefined : orderStatusFilter,
        page: orderPage,
        pageSize: 10,
        startDate: orderStartDate ? `${orderStartDate}T00:00:00.000Z` : undefined,
        endDate: orderEndDate ? `${orderEndDate}T23:59:59.999Z` : undefined
        },
        authToken ?? undefined
      );
      const lines = data.items
        .slice(0, 10)
        .map(
          (o) =>
            `ORDER#${o.id} U${o.userId} ${o.side} ${o.filledQty}/${o.qty} ${o.symbol} @ ${o.price} x${o.leverage} [${o.status}] fee=${o.feeUsdt.toFixed(6)} ${o.createdAt}`
        );
      setOrders(lines);
      setTrades(
        lines
          .filter((line) => line.includes("[FILLED]") || line.includes("[PARTIALLY_FILLED]"))
          .map((line) => line.replace("ORDER", "TRADE"))
      );
      setOrderTotal(data.total);
      setBackendConnected(true);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("AUTH_ERROR:")) {
        handleAuthError();
        return;
      }
      setUiError("주문 이력 동기화 실패");
      setBackendConnected(false);
    }
  };

  const refreshAdminExchangeStatus = async () => {
    try {
      const s = await getAdminExchangeStatus(adminRole, authToken ?? undefined);
      setAdminExchangeHalted(s.halted);
      setAdminExchangeDisabled(s.disabledSymbols);
      const pub = await getExchangePublicStatus();
      if (pub.simMidPrices) setExchangeSimMids(pub.simMidPrices);
    } catch {
      setUiError("관리자 거래소 상태 조회 실패");
    }
  };

  const cancelBackendLimitOrder = async () => {
    const id = Number(pendingCancelOrderId);
    if (!authUser || !authToken || !Number.isFinite(id) || id < 1) {
      setUiError("로그인 후 취소할 서버 주문 ID(숫자)를 입력하세요.");
      return;
    }
    try {
      const r = await cancelOrder(id, authToken);
      setUiError(null);
      setAuditLogs((prev) =>
        [`ORDER_CANCEL_RESULT: #${r.id} → ${r.status}`, ...prev].slice(0, 30)
      );
      const w = await getWallet(authUser.id, authToken);
      setLiveUsdt(w.usdt);
      await syncOrdersFromBackend();
      setPendingCancelOrderId("");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("AUTH_ERROR:")) {
        handleAuthError();
        return;
      }
      setUiError("주문 취소 실패 (미체결·접수 상태만 가능)");
    }
  };

  useEffect(() => {
    if (!authUser) return;
    syncOrdersFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, authUser, orderPage, orderStatusFilter, orderStartDate, orderEndDate]);

  async function submitOrder(
    override?: Partial<{
      side: OrderSide;
      orderType: OrderType;
      qty: number;
      price: number;
      reason: SpeedFill["reason"];
      ocoRole: "TP" | "SL";
    }>
  ) {
    const submitSide = override?.side ?? side;
    const submitType = override?.orderType ?? orderType;
    const rawQty = override?.qty ?? (orderUiMode === "SPEED" ? speedQty : qty);
    const submitQty = marketGroup === "US_FUTURES" ? Math.max(1, Math.round(rawQty)) : rawQty;
    const targetPrice = override?.price ?? (submitType === "MARKET" ? speedPrice || price : limitPrice);
    const currentOrderPrice = snapPrice(targetPrice);
    const validationError = validateOrder({
      qty: submitQty,
      leverage,
      price: currentOrderPrice,
      balanceUsdt: activeBalance
    });
    if (validationError) {
      setUiError(validationError);
      setAuditLogs((prev) => [`ORDER_REJECTED: ${validationError}`, ...prev].slice(0, 30));
      return;
    }
    if (!isPractice && !authUser) {
      setUiError("실거래 주문은 로그인 후 가능합니다.");
      return;
    }
    setUiError(null);
    const label = `${isPractice ? "모의" : "실거래"} ${submitSide} ${submitQty} ${symbol} @ ${
      submitType === "MARKET" ? "MKT" : currentOrderPrice
    } x${leverage}`;
    setLastEntryPrice(currentOrderPrice);
    setLastEntrySide(submitSide);
    setPositions((prev) => [label, ...prev].slice(0, 8));
    setOrders((prev) => [`ORDER: ${label}`, ...prev].slice(0, 20));
    if (submitType === "LIMIT" && orderUiMode === "SPEED") {
      setSpeedOpenOrders((prev) => [
        { id: `${Date.now()}-${Math.random()}`, side: submitSide, price: currentOrderPrice, qty: submitQty },
        ...prev
      ].slice(0, 12));
    }
    if (orderUiMode === "SPEED" && speedUseOco) {
      const groupId = `${Date.now()}-oco-${Math.random()}`;
      const exitSide: OrderSide = submitSide === "LONG" ? "SHORT" : "LONG";
      const tp =
        submitSide === "LONG"
          ? snapPrice(currentOrderPrice + speedTpTicks * tickSize)
          : snapPrice(Math.max(tickSize, currentOrderPrice - speedTpTicks * tickSize));
      const sl =
        submitSide === "LONG"
          ? snapPrice(Math.max(tickSize, currentOrderPrice - speedSlTicks * tickSize))
          : snapPrice(currentOrderPrice + speedSlTicks * tickSize);
      const tpOrder: SpeedOpenOrder = {
        id: `${Date.now()}-tp-${Math.random()}`,
        side: exitSide,
        price: tp,
        qty: submitQty,
        ocoGroup: groupId,
        ocoRole: "TP"
      };
      const slOrder: SpeedOpenOrder = {
        id: `${Date.now()}-sl-${Math.random()}`,
        side: exitSide,
        price: sl,
        qty: submitQty,
        ocoGroup: groupId,
        ocoRole: "SL"
      };
      setSpeedOpenOrders((prev) => [tpOrder, slOrder, ...prev].slice(0, 12));
    }
    let suppressLocalTradeReceipt = false;
    if (!isPractice && authUser) {
      try {
        const result = await postOrder(
          {
            userId: authUser.id,
            symbol,
            side: submitSide,
            orderType: submitType,
            qty: submitQty,
            price: currentOrderPrice,
            leverage
          },
          authToken ?? undefined
        );
        if (result.status === "REJECTED") {
          setUiError(`백엔드 주문 거절: ${result.reason ?? "UNKNOWN"}`);
          setTrades((prev) => [`TRADE_REJECTED: ${label}`, ...prev].slice(0, 20));
          setAuditLogs((prev) => [`TRADE_REJECTED: ${label}`, ...prev].slice(0, 30));
          return;
        }
        try {
          const w = await getWallet(authUser.id, authToken ?? undefined);
          setLiveUsdt(w.usdt);
        } catch {
          setUiError("서버 잔고 동기화 실패. 새로고침 후 다시 시도하세요.");
        }
        if (result.status === "ACCEPTED") {
          suppressLocalTradeReceipt = true;
          setAuditLogs((prev) =>
            [
              `ORDER_ACCEPTED: #${result.id} ${result.symbol} 증거금 잠금 ${result.marginLockedUsdt.toFixed(4)} USDT`,
              ...prev
            ].slice(0, 30)
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("AUTH_ERROR:")) {
          handleAuthError();
          return;
        }
        setUiError("백엔드 주문 연동 실패. 서버를 확인하세요.");
        return;
      }
    }

    if (suppressLocalTradeReceipt) {
      return;
    }

    setTrades((prev) => [`TRADE: ${label}`, ...prev].slice(0, 20));
    setAuditLogs((prev) => [`TRADE_EXECUTED: ${label}`, ...prev].slice(0, 30));
    if (orderUiMode === "SPEED") {
      const fillReason = override?.reason ?? "MANUAL";
      const fill: SpeedFill = {
        id: `${Date.now()}-${Math.random()}`,
        at: new Date().toISOString(),
        side: submitSide,
        symbol,
        price: currentOrderPrice,
        qty: submitQty,
        reason: fillReason,
        ocoRole: override?.ocoRole
      };
      setSpeedFills((prev) => [fill, ...prev].slice(0, 50));
      notifySpeedEvent(`체결 ${submitSide} ${submitQty} ${symbol} @ ${currentOrderPrice} (${fillReason})`);
    }
    if (isPractice) {
      setPracticeUsdt((v) => Math.max(0, v - estimatedCost));
      return;
    }
    if (!authUser) {
      setLiveUsdt((v) => Math.max(0, v - estimatedCost));
    }
  }

  const createTournament = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Tournament = {
      id: Date.now(),
      name: String(form.get("name")),
      startDate: String(form.get("startDate")),
      endDate: String(form.get("endDate")),
      entryFee: Number(form.get("entryFee")),
      seedAsset: Number(form.get("seedAsset")),
      market: String(form.get("market")),
      status: "PENDING"
    };
    setTournaments((prev) => [next, ...prev]);
    event.currentTarget.reset();
  };

  const toggleTournament = (id: number) => {
    setTournaments((prev) =>
      prev.map((t) => {
        if (t.id !== id) {
          return t;
        }
        if (t.status === "PENDING") {
          return { ...t, status: "ACTIVE" };
        }
        if (t.status === "ACTIVE") {
          return { ...t, status: "ENDED" };
        }
        return t;
      })
    );
    setAuditLogs((prev) => [`TOURNAMENT_STATUS_UPDATED: ${id}`, ...prev].slice(0, 30));
  };

  const toggleReferral = (id: number) => {
    setReferralRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule))
    );
    setAuditLogs((prev) => [`REFERRAL_RULE_TOGGLED: ${id}`, ...prev].slice(0, 30));
  };

  const createBranch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parent = form.get("parentId");
    const next: AdminBranch = {
      id: Date.now(),
      name: String(form.get("name")),
      role: String(form.get("role")),
      parentId: parent ? Number(parent) : null,
      rebateRate: Number(form.get("rebateRate")),
      active: true
    };
    setAdminBranches((prev) => [next, ...prev]);
    event.currentTarget.reset();
  };

  const toggleBranch = (id: number) => {
    setAdminBranches((prev) =>
      prev.map((node) => (node.id === id ? { ...node, active: !node.active } : node))
    );
    setAuditLogs((prev) => [`ADMIN_BRANCH_TOGGLED: ${id}`, ...prev].slice(0, 30));
  };

  const updateKycStatus = async (id: number, status: KycTicket["status"]) => {
    if (!otpToken || (otpExpireAt !== null && Date.now() > otpExpireAt)) {
      setUiError("KYC 상태 변경 전 OTP 인증이 필요합니다.");
      return;
    }
    if (authUser && (authUser.role === "SUPER_ADMIN" || authUser.role === "CS_ADMIN")) {
      try {
        const next = await updateAdminKycStatus(authUser.role, id, status, authToken ?? undefined, otpToken);
        setKycTickets((prev) => prev.map((row) => (row.id === id ? next : row)));
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("AUTH_ERROR:")) {
          handleAuthError();
          return;
        }
        setUiError("KYC 상태 변경 API 호출 실패");
        return;
      }
    } else {
      setKycTickets((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
    }
    setAuditLogs((prev) => [`KYC_UPDATED: ${id} => ${status}`, ...prev].slice(0, 30));
  };

  const cycleSettlement = async (id: number) => {
    if (authUser && (authUser.role === "SUPER_ADMIN" || authUser.role === "OPS_ADMIN")) {
      try {
        const next = await progressSettlement(authUser.role, id, authToken ?? undefined, otpToken ?? undefined);
        setSettlementBatches((prev) => prev.map((row) => (row.id === id ? next : row)));
        setBackendConnected(true);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("AUTH_ERROR:")) {
          handleAuthError();
          return;
        }
        setUiError("정산 상태 진행 API 호출 실패");
        setBackendConnected(false);
      }
    } else {
      setSettlementBatches((prev) =>
        prev.map((batch) => {
          if (batch.id !== id) {
            return batch;
          }
          if (batch.status === "READY") {
            return { ...batch, status: "LOCKED" };
          }
          if (batch.status === "LOCKED") {
            return { ...batch, status: "PAID" };
          }
          return batch;
        })
      );
    }
    setAuditLogs((prev) => [`SETTLEMENT_BATCH_PROGRESS: ${id}`, ...prev].slice(0, 30));
  };

  const toggleRiskRule = (id: number) => {
    if (!otpToken || (otpExpireAt !== null && Date.now() > otpExpireAt)) {
      setUiError("리스크 룰 변경 전 OTP 인증이 필요합니다.");
      return;
    }
    setRiskRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== id) return rule;
        setConfigChangeLogs((logs) => [
          {
            id: Date.now(),
            section: "RISK_RULE",
            key: rule.name,
            before: String(rule.enabled),
            after: String(!rule.enabled),
            at: new Date().toISOString(),
            actor: authUser?.email ?? adminRole
          },
          ...logs
        ]);
        return { ...rule, enabled: !rule.enabled };
      })
    );
    setAuditLogs((prev) => [`RISK_RULE_TOGGLED: ${id}`, ...prev].slice(0, 30));
  };

  const updateFeePolicy = (key: keyof FeePolicy, value: number) => {
    if (!otpToken || (otpExpireAt !== null && Date.now() > otpExpireAt)) {
      setUiError("수수료 정책 변경 전 OTP 인증이 필요합니다.");
      return;
    }
    setFeePolicy((prev) => {
      setConfigChangeLogs((logs) => [
        {
          id: Date.now(),
          section: "FEE_POLICY",
          key,
          before: String(prev[key]),
          after: String(value),
          at: new Date().toISOString(),
          actor: authUser?.email ?? adminRole
        },
        ...logs
      ]);
      return { ...prev, [key]: value };
    });
  };

  const createNotice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Notice = {
      id: Date.now(),
      title: String(form.get("title")),
      audience: String(form.get("audience")) as Notice["audience"],
      active: true
    };
    setNotices((prev) => [next, ...prev]);
    event.currentTarget.reset();
  };

  const toggleNotice = (id: number) => {
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, active: !n.active } : n)));
    setAuditLogs((prev) => [`NOTICE_TOGGLED: ${id}`, ...prev].slice(0, 30));
  };

  const simulatedLiqPrice =
    lastEntryPrice !== null ? calcLiquidationPrice(lastEntryPrice, leverage, lastEntrySide) : null;
  const simulatedPnl =
    lastEntryPrice !== null ? calcUnrealizedPnl(lastEntryPrice, price, qty, lastEntrySide) : null;
  const adminKpi = useMemo(() => {
    const filledCount = orders.filter(
      (o) => o.includes("[FILLED]") || o.includes("[PARTIALLY_FILLED]")
    ).length;
    const acceptedCount = orders.filter((o) => o.includes("[ACCEPTED]")).length;
    const rejectedCount = orders.filter((o) => o.includes("[REJECTED]")).length;
    const netRevenue = settlementBatches.reduce((acc, s) => acc + s.netRevenueUsdt, 0);
    return { filledCount, acceptedCount, rejectedCount, netRevenue };
  }, [orders, settlementBatches]);
  const filteredSpeedFills = useMemo(() => {
    const byReason = speedFillFilter === "ALL" ? speedFills : speedFills.filter((f) => f.reason === speedFillFilter);
    const q = speedFillSearch.trim().toUpperCase();
    if (!q) return byReason;
    return byReason.filter(
      (f) =>
        f.symbol.toUpperCase().includes(q) ||
        f.side.toUpperCase().includes(q) ||
        f.reason.toUpperCase().includes(q) ||
        String(f.price).toUpperCase().includes(q) ||
        String(f.ocoRole || "").toUpperCase().includes(q) ||
        formatKst(f.at).toUpperCase().includes(q)
    );
  }, [speedFillFilter, speedFills, speedFillSearch, formatKst]);
  const sortByPrice = <T extends { price: number }>(rows: T[], sort: SpeedListSort) => {
    if (sort === "LATEST") return rows;
    const cloned = [...rows];
    cloned.sort((a, b) => (sort === "PRICE_ASC" ? a.price - b.price : b.price - a.price));
    return cloned;
  };
  const sortedSpeedOpenOrders = useMemo(() => sortByPrice(speedOpenOrders, speedOpenSort), [speedOpenOrders, speedOpenSort]);
  const sortedSpeedMitOrders = useMemo(
    () => (speedMitSort === "LATEST" ? speedMitOrders : [...speedMitOrders].sort((a, b) => (speedMitSort === "PRICE_ASC" ? a.trigger - b.trigger : b.trigger - a.trigger))),
    [speedMitOrders, speedMitSort]
  );
  const sortedSpeedFills = useMemo(() => sortByPrice(filteredSpeedFills, speedFillSort), [filteredSpeedFills, speedFillSort]);

  const exportSpeedFillsCsv = () => {
    const rows = sortedSpeedFills;
    if (rows.length === 0) {
      notifySpeedEvent("내보낼 체결 로그가 없습니다.");
      return;
    }
    const header = ["marketGroup", "symbol", "timeKst", "side", "qty", "price", "reason", "orderUiMode", "tickSize", "ocoRole"];
    const lines = rows.map((f) =>
      [
        marketCfg.label,
        f.symbol,
        `${formatKst(f.at)} KST`,
        f.side,
        String(f.qty),
        String(f.price),
        f.reason,
        "SPEED",
        String(tickSize),
        f.ocoRole ?? ""
      ]
        .map((v) => `"${String(v).replace(/"/g, "\"\"")}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `speed-fills-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notifySpeedEvent(`체결 로그 CSV ${rows.length}건 내보내기 완료`);
  };

  const submitSpeedBookOrder = async (bookSide: OrderSide, targetPrice: number) => {
    const key = `${bookSide}-${targetPrice}`;
    if (speedBookClickMode === "DOUBLE" && speedPendingBookKey !== key) {
      setSpeedPendingBookKey(key);
      return;
    }
    setSpeedPendingBookKey(null);
    if (speedConfirmOrder) {
      const ok = window.confirm(`${bookSide} ${symbol} ${speedQty} @ ${targetPrice} 주문 실행할까요?`);
      if (!ok) return;
    }
    await submitOrder({
      side: bookSide,
      orderType: "LIMIT",
      qty: speedQty,
      price: targetPrice,
      reason: "BOOK"
    });
  };

  const amendLatestSpeedOrder = () => {
    setSpeedOpenOrders((prev) => {
      if (prev.length === 0) return prev;
      const [head, ...rest] = prev;
      const nextPrice = snapPrice(speedPrice || price);
      return [{ ...head, price: nextPrice }, ...rest];
    });
  };

  const cancelAllSpeedOrders = () => {
    setSpeedOpenOrders([]);
  };
  const amendSpeedOrderById = (id: string, deltaTicks: number) => {
    setSpeedOpenOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, price: snapPrice(Math.max(tickSize, o.price + deltaTicks * tickSize)) }
          : o
      )
    );
  };
  const cancelSpeedOrderById = (id: string) => {
    setSpeedOpenOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const placeSpeedMultiOrders = async (entrySide: OrderSide) => {
    const count = Math.max(1, Math.min(10, Number(speedMultiCount) || 1));
    const step = Math.max(1, Number(speedMultiTicks) || 1);
    const base = snapPrice(speedPrice || price);
    for (let i = 0; i < count; i += 1) {
      const raw =
        entrySide === "LONG" ? base - i * step * tickSize : base + i * step * tickSize;
      const px = snapPrice(Math.max(tickSize, raw));
      // eslint-disable-next-line no-await-in-loop
      await submitOrder({ side: entrySide, orderType: "LIMIT", qty: speedQty, price: px });
    }
  };

  const registerMitOrder = (entrySide: OrderSide) => {
    const trigger = snapPrice(speedMitTrigger || price);
    setSpeedMitOrders((prev) => [
      {
        id: `${Date.now()}-mit-${Math.random()}`,
        side: entrySide,
        trigger,
        offsetTicks: Math.max(0, Number(speedMitOffsetTicks) || 0),
        execMode: speedMitExecMode,
        qty: speedQty
      },
      ...prev
    ].slice(0, 20));
  };
  const cancelMitOrderById = (id: string) => {
    setSpeedMitOrders((prev) => prev.filter((m) => m.id !== id));
    notifySpeedEvent("MIT 대기 주문 1건 취소");
  };

  const tradingShellPaths = ["/exchange", "/spot", "/futures", "/simulation"];
  const showSymbolRail = tradingShellPaths.includes(location.pathname);
  const futuresTabActive =
    location.pathname === "/futures" ||
    location.pathname === "/exchange" ||
    location.pathname === "/simulation";
  const midHintForSymbol = (s: string) => {
    const k = s.trim().toUpperCase();
    if (exchangeSimMids[k] != null) return exchangeSimMids[k];
    if (marketGroup === "CRYPTO" && cryptoTickerMids[k] != null) return cryptoTickerMids[k];
    if (s === symbol) return price;
    return null;
  };

  const tvChartSymbol = useMemo(
    () => tradingViewSymbol(marketGroup, symbol),
    [marketGroup, symbol]
  );

  const orderBookCard = (
    <div className="card exchangeOrderbookCard">
      <h3>오더북</h3>
      <small>
        오더북 모드:{" "}
        {dataGrade.orderbook === "MOCK"
          ? "시뮬레이션 호가"
          : dataGrade.orderbook === "LIVE" && isCryptoGroup
            ? cryptoDepthFromWs
              ? "Bitget USDT-M 호가 (WS books15)"
              : "Bitget USDT-M 호가 (REST 스냅샷)"
            : "외부호가"}
      </small>
      {orderUiMode === "SPEED" ? (
        <div className="stack">
          <small>스피드북: 행 버튼으로 즉시 주문</small>
          <div className="twoCol">
            <label>
              클릭 모드
              <select
                value={speedBookClickMode}
                onChange={(e) => setSpeedBookClickMode(e.target.value as SpeedClickMode)}
              >
                <option value="ONE">1클릭</option>
                <option value="DOUBLE">더블클릭</option>
              </select>
            </label>
            <label>
              주문확인
              <select
                value={speedConfirmOrder ? "ON" : "OFF"}
                onChange={(e) => setSpeedConfirmOrder(e.target.value === "ON")}
              >
                <option value="OFF">OFF</option>
                <option value="ON">ON</option>
              </select>
            </label>
          </div>
          {dataGrade.orderbook === "MOCK" ? (
            <small className="orderbookWarn">
              MOCK 호가 기반 주문입니다. 실제 거래소 호가와 체결 결과가 다를 수 있습니다.
            </small>
          ) : null}
        </div>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>ASK</th>
            <th>{qtyLabel}</th>
            {isFuturesGroup ? <th>매도명목(USD)</th> : null}
            {isStockGroup ? <th>매도잔량비</th> : null}
            {isCryptoGroup ? <th>매도노셔널(USDT)</th> : null}
            <th>BID</th>
            <th>{qtyLabel}</th>
            {isFuturesGroup ? <th>매수명목(USD)</th> : null}
            {isStockGroup ? <th>매수잔량비</th> : null}
            {isCryptoGroup ? <th>매수노셔널(USDT)</th> : null}
            {orderUiMode === "SPEED" ? <th>주문</th> : null}
          </tr>
        </thead>
        <tbody>
          {orderBook.map((row) => (
            <tr key={`${row.ask}-${row.bid}`}>
              <td>{row.ask.toLocaleString()}</td>
              <td>{formatBookQty(row.askQty)}</td>
              {isFuturesGroup ? (
                <td>
                  {symbolContractSpec
                    ? Math.round(row.ask * row.askQty * symbolContractSpec.multiplier).toLocaleString()
                    : "-"}
                </td>
              ) : null}
              {isStockGroup ? (
                <td>{((row.askQty / Math.max(1, row.askQty + row.bidQty)) * 100).toFixed(1)}%</td>
              ) : null}
              {isCryptoGroup ? <td>{(row.ask * row.askQty).toFixed(1)}</td> : null}
              <td>{row.bid.toLocaleString()}</td>
              <td>{formatBookQty(row.bidQty)}</td>
              {isFuturesGroup ? (
                <td>
                  {symbolContractSpec
                    ? Math.round(row.bid * row.bidQty * symbolContractSpec.multiplier).toLocaleString()
                    : "-"}
                </td>
              ) : null}
              {isStockGroup ? (
                <td>{((row.bidQty / Math.max(1, row.askQty + row.bidQty)) * 100).toFixed(1)}%</td>
              ) : null}
              {isCryptoGroup ? <td>{(row.bid * row.bidQty).toFixed(1)}</td> : null}
              {orderUiMode === "SPEED" ? (
                <td>
                  <div className="rowActions">
                    <button className="ghost" onClick={() => submitSpeedBookOrder("SHORT", row.ask)}>
                      매도
                    </button>
                    <button onClick={() => submitSpeedBookOrder("LONG", row.bid)}>매수</button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="app">
      <header className="header">
        <div className="headerTop">
          <div className="brandRow">
            <h1>Tetherget 거래소</h1>
            <span className="brandBadge" title="제품 코드명">
              TGX CEX
            </span>
          </div>
          <div className="tradeModeTabs" role="tablist" aria-label="현물·선물 모드">
            <NavLink
              to="/spot"
              className={({ isActive }) => (isActive ? "tradeModeTab tradeModeTab--active" : "tradeModeTab")}
            >
              Spot
            </NavLink>
            <NavLink
              to="/futures"
              className={() => (futuresTabActive ? "tradeModeTab tradeModeTab--active" : "tradeModeTab")}
            >
              Futures
            </NavLink>
          </div>
        </div>
        <p>
          중앙화 코인 거래소(CEX): 현물·선물·지갑·주문체결 구조. P2P(유저 간 직거래) 기능 없음.
        </p>
        <p className="muted">Spot · Futures · 모의투자 · 대회 · 관리자 · 레퍼럴</p>
        <div className="twoCol">
          <label>
            시장군
            <select value={marketGroup} onChange={(e) => setMarketGroup(e.target.value as MarketGroupKey)}>
              {Object.entries(MARKET_GROUPS).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            심볼
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {marketCfg.symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>
          Backend: {backendConnected ? "CONNECTED" : "OFFLINE"} / User:{" "}
          {authUser ? `${authUser.email} (${authUser.role})` : "미로그인"}
        </p>
        {authToken ? <small>Session Token: {authToken}</small> : null}
        {sessionExpireAt ? <small>Session Expires: {new Date(sessionExpireAt).toLocaleString()}</small> : null}
        {authUser ? (
          <div>
            <button className="ghost" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        ) : null}
      </header>

      <nav className="nav">
        {navItems.map(([label, to]) => (
          <Link key={to} to={to} className={location.pathname === to ? "active" : ""}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="marketQuickBar" role="toolbar" aria-label="시장 유형 빠른 선택">
        <span className="marketQuickBar-label">시장</span>
        {(Object.keys(MARKET_GROUPS) as MarketGroupKey[]).map((key) => {
          const cfg = MARKET_GROUPS[key];
          return (
            <button
              key={key}
              type="button"
              className={marketGroup === key ? "marketQuickBtn marketQuickBtn--active" : "marketQuickBtn"}
              onClick={() => setMarketGroup(key)}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      <div className={showSymbolRail ? "tradingShell" : undefined}>
        {showSymbolRail ? (
          <aside className="symbolRail panel" aria-label="심볼·시세 목록">
            <div className="symbolRail-head">
              <span className="symbolRail-title">{marketCfg.label}</span>
              <span className="symbolRail-src">{marketCfg.sourceLabel}</span>
            </div>
            <ul className="symbolRail-list">
              {marketCfg.symbols.map((s) => {
                const mid = midHintForSymbol(s);
                const rowChg = symbolDayChangePct[symChangeKey(marketGroup, s)];
                const chgStr =
                  rowChg !== undefined ? `${rowChg >= 0 ? "+" : ""}${rowChg.toFixed(2)}%` : "—";
                const chgUp = rowChg !== undefined && rowChg >= 0;
                return (
                  <li key={s}>
                    <button
                      type="button"
                      className={symbol === s ? "symbolRail-row symbolRail-row--active" : "symbolRail-row"}
                      onClick={() => setSymbol(s)}
                    >
                      <div className="symbolRail-row-main">
                        <span className="symbolRail-sym">{s}</span>
                        <span
                          className={
                            rowChg === undefined
                              ? "symbolRail-chg symbolRail-chg--na"
                              : chgUp
                                ? "symbolRail-chg symbolRail-chg--up"
                                : "symbolRail-chg symbolRail-chg--down"
                          }
                        >
                          {chgStr}
                        </span>
                      </div>
                      <span className="symbolRail-px">
                        {mid != null
                          ? mid.toLocaleString(undefined, { maximumFractionDigits: Math.max(2, decimals) })
                          : "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        ) : null}

        <main className="grid">
        {alerts.length > 0 ? (
          <div className="card">
            <strong>실시간 운영 알림:</strong> [{alerts[0].level}] {alerts[0].message}
          </div>
        ) : null}
        {uiError ? (
          <div className="errorBanner">
            <strong>주문 오류:</strong> {uiError}
          </div>
        ) : null}
        {speedEventNotice ? (
          <div className="card">
            <strong>[스피드 알림]</strong> {speedEventNotice}
          </div>
        ) : null}
        {showSymbolRail && tvChartSymbol && location.pathname !== "/exchange" ? (
          <div className="card chartDock">
            <div className="chartDock-head">
              <h3 className="chartDock-title">차트</h3>
              <small className="chartDock-meta">
                {tvChartSymbol} · TradingView
              </small>
            </div>
            <TradingViewEmbed tvSymbol={tvChartSymbol} />
          </div>
        ) : null}
        <Routes>
          <Route
            path="/"
            element={
              <ShellPage title="메인">
                <div>
                  <p>
                    이 프로젝트는 <strong>중앙화 거래소(CEX)</strong> 형태입니다. 거래소가 주문·체결 흐름을 중앙에서 다루며,
                    P2P 마켓(매물 게시·1:1 이체)과는 다릅니다.
                  </p>
                  <p>
                    현물·선물·모의투자·수익률 대회·관리자(정산·KYC·출금 승인 등)·레퍼럴을 포함합니다.
                  </p>
                </div>
              </ShellPage>
            }
          />
          <Route
            path="/auth"
            element={
              <ShellPage title="로그인/회원가입">
                <div className="stack">
                  <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="이메일" />
                  <input
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="비밀번호"
                    type="password"
                  />
                  <button onClick={handleLogin}>로그인</button>
                  <button className="ghost">회원가입</button>
                </div>
              </ShellPage>
            }
          />
          <Route
            path="/exchange"
            element={
              <ShellPage title="거래소">
                {exchangePublicHalted ? (
                  <div className="errorBanner">
                    <strong>플랫폼 거래 정지:</strong> 관리자 설정으로 신규 주문이 서버에서 거절됩니다.
                  </div>
                ) : null}
                {!exchangePublicHalted &&
                exchangePublicDisabled.includes(symbol.trim().toUpperCase()) ? (
                  <div className="errorBanner">
                    <strong>심볼 거래 OFF:</strong> 이 종목은 현재 주문을 받지 않습니다.
                  </div>
                ) : null}
                <div
                  className={
                    tvChartSymbol ? "exchangeTopSplit" : "exchangeTopSplit exchangeTopSplit--bookOnly"
                  }
                >
                  {tvChartSymbol ? (
                    <div className="card chartDock chartDock--exchange">
                      <div className="chartDock-head">
                        <h3 className="chartDock-title">차트</h3>
                        <small className="chartDock-meta">
                          {tvChartSymbol} · TradingView
                        </small>
                      </div>
                      <TradingViewEmbed tvSymbol={tvChartSymbol} />
                    </div>
                  ) : null}
                  {orderBookCard}
                </div>
                <div className="twoCol">
                  <div className="card">
                    <h3>시장</h3>
                    <div className="rowActions">
                      <span className={`dataBadge dataBadge--${dataGrade.ticker.toLowerCase()}`} title={tickerGradeReason}>
                        Ticker {dataGrade.ticker}
                      </span>
                      <span className={`dataBadge dataBadge--${dataGrade.orderbook.toLowerCase()}`} title={bookGradeReason}>
                        Orderbook {dataGrade.orderbook}
                      </span>
                    </div>
                    <small className="dataHint">Ticker: {tickerGradeReason}</small>
                    <small className="dataHint">Orderbook: {bookGradeReason}</small>
                    {isCryptoGroup ? (
                      <small className="dataHint">
                        서버 시뮬 중간가(LIMIT 매칭 참조):{" "}
                        {exchangeSimMids[symbol.trim().toUpperCase()] != null
                          ? `${exchangeSimMids[symbol.trim().toUpperCase()].toLocaleString()} USDT`
                          : "—"}
                      </small>
                    ) : null}
                    <p>{symbol}: {price.toLocaleString(undefined, { maximumFractionDigits: Math.max(2, decimals) })}</p>
                    <p>24h: {marketChange.toFixed(2)}%</p>
                    {marketGroup === "US_FUTURES" && symbolContractSpec ? (
                      <p>
                        계약규격: {symbolContractSpec.name} · 승수 {symbolContractSpec.multiplier} {symbolContractSpec.unit}
                      </p>
                    ) : isStockGroup ? (
                      <p>주식형 시세모드: 호가잔량(주) 중심 · 체결량은 실시간 볼륨 반영</p>
                    ) : isCryptoGroup ? (
                      <p>
                        펀딩(예상): {cryptoFundingPct != null ? `${cryptoFundingPct.toFixed(4)}%` : "—"}
                        {cryptoMarkPrice != null
                          ? ` · 마크 ${cryptoMarkPrice.toLocaleString(undefined, { maximumFractionDigits: Math.max(2, decimals) })}`
                          : ""}{" "}
                        · USDT-M 무기한
                      </p>
                    ) : (
                      <p>Funding: 0.01%</p>
                    )}
                    {marketLiveVolume != null ? <p>실시간 거래량: {marketLiveVolume.toLocaleString()} {qtyLabel}</p> : null}
                    <small>
                      시세 소스: {apiStatus === "CONNECTED" ? marketCfg.sourceLabel : "Mock Fallback"} · {marketCfg.label}
                    </small>
                    <small>
                      데이터 신뢰도: Ticker={dataGrade.ticker}, Orderbook={dataGrade.orderbook}
                    </small>
                  </div>
                  <div className="card">
                    <h3>주문 패널</h3>
                    <p>아래에 스피드·기본 주문창이 표시됩니다. 현물·선물 전용 메뉴에서도 동일 UI를 사용합니다.</p>
                  </div>
                  <div className="card">
                    <h3>실시간 체결 스트림</h3>
                    <p>최근 체결: {trades[0] ?? "아직 체결 내역 없음"}</p>
                  </div>
                  <div className="card">
                    <h3>포지션 계산</h3>
                    <p>예상 청산가: {simulatedLiqPrice ? simulatedLiqPrice.toFixed(2) : "-"}</p>
                    <p>미실현손익: {simulatedPnl ? simulatedPnl.toFixed(2) : "0.00"} USDT</p>
                  </div>
                </div>
                <div className="stack exchangeOrderDock">
                  <TradePanel
                    isPractice={isPractice}
                    setIsPractice={setIsPractice}
                    activeBalance={activeBalance}
                    qty={qty}
                    setQty={setQty}
                    leverage={leverage}
                    setLeverage={setLeverage}
                    side={side}
                    setSide={setSide}
                    orderType={orderType}
                    setOrderType={setOrderType}
                    limitPrice={limitPrice}
                    setLimitPrice={setLimitPrice}
                    estimatedCost={estimatedCost}
                    submitOrder={submitOrder}
                    allowLeverage={marketGroup === "US_FUTURES"}
                    orderUiMode={orderUiMode}
                    setOrderUiMode={setOrderUiMode}
                    speedQty={speedQty}
                    setSpeedQty={setSpeedQty}
                    speedPrice={speedPrice}
                    setSpeedPrice={setSpeedPrice}
                    symbol={symbol}
                    tickSize={tickSize}
                    marketPrice={price}
                    speedOpenOrders={sortedSpeedOpenOrders}
                    onAmendLatestSpeedOrder={amendLatestSpeedOrder}
                    onCancelAllSpeedOrders={cancelAllSpeedOrders}
                    onAmendSpeedOrderById={amendSpeedOrderById}
                    onCancelSpeedOrderById={cancelSpeedOrderById}
                    speedPendingBookKey={speedPendingBookKey}
                    speedMultiTicks={speedMultiTicks}
                    setSpeedMultiTicks={setSpeedMultiTicks}
                    speedMultiCount={speedMultiCount}
                    setSpeedMultiCount={setSpeedMultiCount}
                    placeSpeedMultiOrders={placeSpeedMultiOrders}
                    speedMitEnabled={speedMitEnabled}
                    setSpeedMitEnabled={setSpeedMitEnabled}
                    speedMitTrigger={speedMitTrigger}
                    setSpeedMitTrigger={setSpeedMitTrigger}
                    speedMitOffsetTicks={speedMitOffsetTicks}
                    setSpeedMitOffsetTicks={setSpeedMitOffsetTicks}
                    speedMitExecMode={speedMitExecMode}
                    setSpeedMitExecMode={setSpeedMitExecMode}
                    registerMitOrder={registerMitOrder}
                    cancelMitOrderById={cancelMitOrderById}
                    speedMitOrders={sortedSpeedMitOrders}
                    speedUseOco={speedUseOco}
                    setSpeedUseOco={setSpeedUseOco}
                    speedTpTicks={speedTpTicks}
                    setSpeedTpTicks={setSpeedTpTicks}
                    speedSlTicks={speedSlTicks}
                    setSpeedSlTicks={setSpeedSlTicks}
                    speedFills={sortedSpeedFills}
                    speedBottomTab={speedBottomTab}
                    setSpeedBottomTab={setSpeedBottomTab}
                    speedFillFilter={speedFillFilter}
                    setSpeedFillFilter={setSpeedFillFilter}
                    speedOpenSort={speedOpenSort}
                    setSpeedOpenSort={setSpeedOpenSort}
                    speedMitSort={speedMitSort}
                    setSpeedMitSort={setSpeedMitSort}
                    speedFillSort={speedFillSort}
                    setSpeedFillSort={setSpeedFillSort}
                    exportSpeedFillsCsv={exportSpeedFillsCsv}
                    formatKst={formatKst}
                    marketGroupLabel={marketCfg.label}
                    speedToggleConfirm={speedToggleConfirm}
                    setSpeedToggleConfirm={setSpeedToggleConfirm}
                    speedPanelTab={speedPanelTab}
                    setSpeedPanelTab={setSpeedPanelTab}
                    speedSummaryCollapsed={speedSummaryCollapsed}
                    setSpeedSummaryCollapsed={setSpeedSummaryCollapsed}
                    speedFillSearch={speedFillSearch}
                    setSpeedFillSearch={setSpeedFillSearch}
                    speedOpenWarnThreshold={speedOpenWarnThreshold}
                    setSpeedOpenWarnThreshold={setSpeedOpenWarnThreshold}
                    speedMitWarnThreshold={speedMitWarnThreshold}
                    setSpeedMitWarnThreshold={setSpeedMitWarnThreshold}
                    futuresContractMode={marketGroup === "US_FUTURES"}
                  />
                </div>
              </ShellPage>
            }
          />
          <Route
            path="/spot"
            element={
              <ShellPage title="현물거래">
                <TradePanel
                  isPractice={isPractice}
                  setIsPractice={setIsPractice}
                  activeBalance={activeBalance}
                  qty={qty}
                  setQty={setQty}
                  leverage={1}
                  setLeverage={setLeverage}
                  side={side}
                  setSide={setSide}
                  orderType={orderType}
                  setOrderType={setOrderType}
                  limitPrice={limitPrice}
                  setLimitPrice={setLimitPrice}
                  estimatedCost={estimatedCost}
                  submitOrder={submitOrder}
                  allowLeverage={false}
                  orderUiMode={orderUiMode}
                  setOrderUiMode={setOrderUiMode}
                  speedQty={speedQty}
                  setSpeedQty={setSpeedQty}
                  speedPrice={speedPrice}
                  setSpeedPrice={setSpeedPrice}
                  symbol={symbol}
                  tickSize={tickSize}
                  marketPrice={price}
                  speedOpenOrders={sortedSpeedOpenOrders}
                  onAmendLatestSpeedOrder={amendLatestSpeedOrder}
                  onCancelAllSpeedOrders={cancelAllSpeedOrders}
                  onAmendSpeedOrderById={amendSpeedOrderById}
                  onCancelSpeedOrderById={cancelSpeedOrderById}
                  speedPendingBookKey={speedPendingBookKey}
                  speedMultiTicks={speedMultiTicks}
                  setSpeedMultiTicks={setSpeedMultiTicks}
                  speedMultiCount={speedMultiCount}
                  setSpeedMultiCount={setSpeedMultiCount}
                  placeSpeedMultiOrders={placeSpeedMultiOrders}
                  speedMitEnabled={speedMitEnabled}
                  setSpeedMitEnabled={setSpeedMitEnabled}
                  speedMitTrigger={speedMitTrigger}
                  setSpeedMitTrigger={setSpeedMitTrigger}
                  speedMitOffsetTicks={speedMitOffsetTicks}
                  setSpeedMitOffsetTicks={setSpeedMitOffsetTicks}
                  speedMitExecMode={speedMitExecMode}
                  setSpeedMitExecMode={setSpeedMitExecMode}
                  registerMitOrder={registerMitOrder}
                  cancelMitOrderById={cancelMitOrderById}
                  speedMitOrders={sortedSpeedMitOrders}
                  speedUseOco={speedUseOco}
                  setSpeedUseOco={setSpeedUseOco}
                  speedTpTicks={speedTpTicks}
                  setSpeedTpTicks={setSpeedTpTicks}
                  speedSlTicks={speedSlTicks}
                  setSpeedSlTicks={setSpeedSlTicks}
                  speedFills={sortedSpeedFills}
                  speedBottomTab={speedBottomTab}
                  setSpeedBottomTab={setSpeedBottomTab}
                  speedFillFilter={speedFillFilter}
                  setSpeedFillFilter={setSpeedFillFilter}
                  speedOpenSort={speedOpenSort}
                  setSpeedOpenSort={setSpeedOpenSort}
                  speedMitSort={speedMitSort}
                  setSpeedMitSort={setSpeedMitSort}
                  speedFillSort={speedFillSort}
                  setSpeedFillSort={setSpeedFillSort}
                  exportSpeedFillsCsv={exportSpeedFillsCsv}
                  formatKst={formatKst}
                  marketGroupLabel={marketCfg.label}
                  speedToggleConfirm={speedToggleConfirm}
                  setSpeedToggleConfirm={setSpeedToggleConfirm}
                  speedPanelTab={speedPanelTab}
                  setSpeedPanelTab={setSpeedPanelTab}
                  speedSummaryCollapsed={speedSummaryCollapsed}
                  setSpeedSummaryCollapsed={setSpeedSummaryCollapsed}
                  speedFillSearch={speedFillSearch}
                  setSpeedFillSearch={setSpeedFillSearch}
                  speedOpenWarnThreshold={speedOpenWarnThreshold}
                  setSpeedOpenWarnThreshold={setSpeedOpenWarnThreshold}
                  speedMitWarnThreshold={speedMitWarnThreshold}
                  setSpeedMitWarnThreshold={setSpeedMitWarnThreshold}
                  futuresContractMode={marketGroup === "US_FUTURES"}
                />
              </ShellPage>
            }
          />
          <Route
            path="/futures"
            element={
              <ShellPage title="선물거래">
                <TradePanel
                  isPractice={isPractice}
                  setIsPractice={setIsPractice}
                  activeBalance={activeBalance}
                  qty={qty}
                  setQty={setQty}
                  leverage={leverage}
                  setLeverage={setLeverage}
                  side={side}
                  setSide={setSide}
                  orderType={orderType}
                  setOrderType={setOrderType}
                  limitPrice={limitPrice}
                  setLimitPrice={setLimitPrice}
                  estimatedCost={estimatedCost}
                  submitOrder={submitOrder}
                  allowLeverage
                  orderUiMode={orderUiMode}
                  setOrderUiMode={setOrderUiMode}
                  speedQty={speedQty}
                  setSpeedQty={setSpeedQty}
                  speedPrice={speedPrice}
                  setSpeedPrice={setSpeedPrice}
                  symbol={symbol}
                  tickSize={tickSize}
                  marketPrice={price}
                  speedOpenOrders={sortedSpeedOpenOrders}
                  onAmendLatestSpeedOrder={amendLatestSpeedOrder}
                  onCancelAllSpeedOrders={cancelAllSpeedOrders}
                  onAmendSpeedOrderById={amendSpeedOrderById}
                  onCancelSpeedOrderById={cancelSpeedOrderById}
                  speedPendingBookKey={speedPendingBookKey}
                  speedMultiTicks={speedMultiTicks}
                  setSpeedMultiTicks={setSpeedMultiTicks}
                  speedMultiCount={speedMultiCount}
                  setSpeedMultiCount={setSpeedMultiCount}
                  placeSpeedMultiOrders={placeSpeedMultiOrders}
                  speedMitEnabled={speedMitEnabled}
                  setSpeedMitEnabled={setSpeedMitEnabled}
                  speedMitTrigger={speedMitTrigger}
                  setSpeedMitTrigger={setSpeedMitTrigger}
                  speedMitOffsetTicks={speedMitOffsetTicks}
                  setSpeedMitOffsetTicks={setSpeedMitOffsetTicks}
                  speedMitExecMode={speedMitExecMode}
                  setSpeedMitExecMode={setSpeedMitExecMode}
                  registerMitOrder={registerMitOrder}
                  cancelMitOrderById={cancelMitOrderById}
                  speedMitOrders={sortedSpeedMitOrders}
                  speedUseOco={speedUseOco}
                  setSpeedUseOco={setSpeedUseOco}
                  speedTpTicks={speedTpTicks}
                  setSpeedTpTicks={setSpeedTpTicks}
                  speedSlTicks={speedSlTicks}
                  setSpeedSlTicks={setSpeedSlTicks}
                  speedFills={sortedSpeedFills}
                  speedBottomTab={speedBottomTab}
                  setSpeedBottomTab={setSpeedBottomTab}
                  speedFillFilter={speedFillFilter}
                  setSpeedFillFilter={setSpeedFillFilter}
                  speedOpenSort={speedOpenSort}
                  setSpeedOpenSort={setSpeedOpenSort}
                  speedMitSort={speedMitSort}
                  setSpeedMitSort={setSpeedMitSort}
                  speedFillSort={speedFillSort}
                  setSpeedFillSort={setSpeedFillSort}
                  exportSpeedFillsCsv={exportSpeedFillsCsv}
                  formatKst={formatKst}
                  marketGroupLabel={marketCfg.label}
                  speedToggleConfirm={speedToggleConfirm}
                  setSpeedToggleConfirm={setSpeedToggleConfirm}
                  speedPanelTab={speedPanelTab}
                  setSpeedPanelTab={setSpeedPanelTab}
                  speedSummaryCollapsed={speedSummaryCollapsed}
                  setSpeedSummaryCollapsed={setSpeedSummaryCollapsed}
                  speedFillSearch={speedFillSearch}
                  setSpeedFillSearch={setSpeedFillSearch}
                  speedOpenWarnThreshold={speedOpenWarnThreshold}
                  setSpeedOpenWarnThreshold={setSpeedOpenWarnThreshold}
                  speedMitWarnThreshold={speedMitWarnThreshold}
                  setSpeedMitWarnThreshold={setSpeedMitWarnThreshold}
                  futuresContractMode={marketGroup === "US_FUTURES"}
                />
              </ShellPage>
            }
          />
          <Route
            path="/simulation"
            element={
              <ShellPage title="모의투자">
                <div className="stack">
                  <div className="card">
                    <h3>모의 계정 잔고</h3>
                    <strong>{practiceUsdt.toFixed(2)} USDT</strong>
                    <p>실계정과 완전히 분리된 가상 자산입니다.</p>
                  </div>
                  <TradePanel
                    isPractice
                    setIsPractice={setIsPractice}
                    activeBalance={practiceUsdt}
                    qty={qty}
                    setQty={setQty}
                    leverage={leverage}
                    setLeverage={setLeverage}
                    side={side}
                    setSide={setSide}
                    orderType={orderType}
                    setOrderType={setOrderType}
                    limitPrice={limitPrice}
                    setLimitPrice={setLimitPrice}
                    estimatedCost={estimatedCost}
                    submitOrder={submitOrder}
                    allowLeverage
                    orderUiMode={orderUiMode}
                    setOrderUiMode={setOrderUiMode}
                    speedQty={speedQty}
                    setSpeedQty={setSpeedQty}
                    speedPrice={speedPrice}
                    setSpeedPrice={setSpeedPrice}
                    symbol={symbol}
                    tickSize={tickSize}
                    marketPrice={price}
                    speedOpenOrders={sortedSpeedOpenOrders}
                    onAmendLatestSpeedOrder={amendLatestSpeedOrder}
                    onCancelAllSpeedOrders={cancelAllSpeedOrders}
                    onAmendSpeedOrderById={amendSpeedOrderById}
                    onCancelSpeedOrderById={cancelSpeedOrderById}
                    speedPendingBookKey={speedPendingBookKey}
                    speedMultiTicks={speedMultiTicks}
                    setSpeedMultiTicks={setSpeedMultiTicks}
                    speedMultiCount={speedMultiCount}
                    setSpeedMultiCount={setSpeedMultiCount}
                    placeSpeedMultiOrders={placeSpeedMultiOrders}
                    speedMitEnabled={speedMitEnabled}
                    setSpeedMitEnabled={setSpeedMitEnabled}
                    speedMitTrigger={speedMitTrigger}
                    setSpeedMitTrigger={setSpeedMitTrigger}
                    speedMitOffsetTicks={speedMitOffsetTicks}
                    setSpeedMitOffsetTicks={setSpeedMitOffsetTicks}
                    speedMitExecMode={speedMitExecMode}
                    setSpeedMitExecMode={setSpeedMitExecMode}
                    registerMitOrder={registerMitOrder}
                    cancelMitOrderById={cancelMitOrderById}
                    speedMitOrders={sortedSpeedMitOrders}
                    speedUseOco={speedUseOco}
                    setSpeedUseOco={setSpeedUseOco}
                    speedTpTicks={speedTpTicks}
                    setSpeedTpTicks={setSpeedTpTicks}
                    speedSlTicks={speedSlTicks}
                    setSpeedSlTicks={setSpeedSlTicks}
                    speedFills={sortedSpeedFills}
                    speedBottomTab={speedBottomTab}
                    setSpeedBottomTab={setSpeedBottomTab}
                    speedFillFilter={speedFillFilter}
                    setSpeedFillFilter={setSpeedFillFilter}
                    speedOpenSort={speedOpenSort}
                    setSpeedOpenSort={setSpeedOpenSort}
                    speedMitSort={speedMitSort}
                    setSpeedMitSort={setSpeedMitSort}
                    speedFillSort={speedFillSort}
                    setSpeedFillSort={setSpeedFillSort}
                    exportSpeedFillsCsv={exportSpeedFillsCsv}
                    formatKst={formatKst}
                    marketGroupLabel={marketCfg.label}
                    speedToggleConfirm={speedToggleConfirm}
                    setSpeedToggleConfirm={setSpeedToggleConfirm}
                    speedPanelTab={speedPanelTab}
                    setSpeedPanelTab={setSpeedPanelTab}
                    speedSummaryCollapsed={speedSummaryCollapsed}
                    setSpeedSummaryCollapsed={setSpeedSummaryCollapsed}
                    speedFillSearch={speedFillSearch}
                    setSpeedFillSearch={setSpeedFillSearch}
                    speedOpenWarnThreshold={speedOpenWarnThreshold}
                    setSpeedOpenWarnThreshold={setSpeedOpenWarnThreshold}
                    speedMitWarnThreshold={speedMitWarnThreshold}
                    setSpeedMitWarnThreshold={setSpeedMitWarnThreshold}
                    futuresContractMode={marketGroup === "US_FUTURES"}
                  />
                </div>
              </ShellPage>
            }
          />
          <Route
            path="/tournament"
            element={
              <ShellPage title="개인 수익률 대회">
                <div className="twoCol">
                  <form onSubmit={createTournament} className="card stack">
                    <h3>대회 생성</h3>
                    <input name="name" required placeholder="대회명" />
                    <input name="startDate" required type="date" />
                    <input name="endDate" required type="date" />
                    <input name="entryFee" required type="number" placeholder="참가비 (USDT)" />
                    <input name="seedAsset" required type="number" placeholder="시작 자산 (USDT)" />
                    <input name="market" required placeholder="거래 가능 종목" />
                    <button type="submit">대회 생성</button>
                  </form>
                  <div className="card">
                    <h3>대회 목록</h3>
                    <ul className="list">
                      {tournaments.map((t) => (
                        <li key={t.id}>
                          <div>
                            <strong>{t.name}</strong>
                            <p>
                              {t.startDate} ~ {t.endDate} / Seed: {t.seedAsset} / Fee: {t.entryFee}
                            </p>
                            <p>종목: {t.market}</p>
                            <small>상태: {t.status}</small>
                          </div>
                          <button onClick={() => toggleTournament(t.id)}>상태 전환</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </ShellPage>
            }
          />
          <Route
            path="/ranking"
            element={
              <ShellPage title="실시간 랭킹">
                <table>
                  <thead>
                    <tr>
                      <th>참가자</th>
                      <th>ROI</th>
                      <th>총수익</th>
                      <th>거래횟수</th>
                      <th>승률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((row) => (
                      <tr key={row.user}>
                        <td>{row.user}</td>
                        <td>{row.roi}%</td>
                        <td>{row.pnl} USDT</td>
                        <td>{row.trades}</td>
                        <td>{row.winRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ShellPage>
            }
          />
          <Route
            path="/wallet"
            element={
              <ShellPage title="지갑">
                <div className="twoCol">
                  <div className="card">
                    <h3>실거래 잔고</h3>
                    <strong>{liveUsdt.toFixed(2)} USDT</strong>
                  </div>
                  <div className="card">
                    <h3>모의투자 잔고</h3>
                    <strong>{practiceUsdt.toFixed(2)} USDT</strong>
                  </div>
                </div>
              </ShellPage>
            }
          />
          <Route
            path="/wallet/flow"
            element={
              <ShellPage title="입금/출금">
                <div className="stack">
                  <button>입금 주소 발급</button>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                    placeholder="출금 금액 (USDT)"
                  />
                  <input
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder="출금 주소"
                  />
                  <button className="ghost" onClick={submitWithdrawal}>
                    출금 요청
                  </button>
                  <p>이 화면은 추후 지갑 API 연결 가능한 구조로 분리 예정입니다.</p>
                </div>
              </ShellPage>
            }
          />
          <Route
            path="/mypage"
            element={
              <ShellPage title="마이페이지">
                <div className="stack">
                  <div className="card">
                    <h3>보안 설정</h3>
                    <button>2FA 활성화</button>
                    <button className="ghost">출금 화이트리스트 설정</button>
                  </div>
                  <div className="card">
                    <h3>주문/포지션 기록</h3>
                    <ul className="list">
                      {positions.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="card">
                    <h3>주문/체결 이력</h3>
                    {authUser?.role === "TRADER" ? (
                      <div className="stack">
                        <small>서버 LIMIT 미체결(접수) 취소 — 주문 목록의 ORDER#번호 입력</small>
                        <div className="twoCol">
                          <input
                            type="number"
                            min={1}
                            placeholder="주문 ID"
                            value={pendingCancelOrderId}
                            onChange={(e) => setPendingCancelOrderId(e.target.value)}
                          />
                          <button type="button" className="ghost" onClick={() => void cancelBackendLimitOrder()}>
                            서버 주문 취소
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value as "ALL" | ApiOrderStatus)}
                    >
                      <option value="ALL">전체 상태</option>
                      <option value="ACCEPTED">접수(미체결)</option>
                      <option value="PARTIALLY_FILLED">부분체결</option>
                      <option value="FILLED">전체체결</option>
                      <option value="CANCEL_PENDING">취소대기</option>
                      <option value="CANCELLED">취소완료</option>
                      <option value="REJECTED">거절</option>
                    </select>
                    <div className="twoCol">
                      <label>
                        시작일
                        <input type="date" value={orderStartDate} onChange={(e) => setOrderStartDate(e.target.value)} />
                      </label>
                      <label>
                        종료일
                        <input type="date" value={orderEndDate} onChange={(e) => setOrderEndDate(e.target.value)} />
                      </label>
                    </div>
                    <div className="rowActions">
                      <button onClick={() => setOrderPage((v) => Math.max(1, v - 1))}>이전 페이지</button>
                      <small>
                        페이지 {orderPage} / 총 {Math.max(1, Math.ceil(orderTotal / 10))}
                      </small>
                      <button
                        onClick={() =>
                          setOrderPage((v) => (v < Math.ceil(orderTotal / 10) ? v + 1 : v))
                        }
                      >
                        다음 페이지
                      </button>
                    </div>
                    <button onClick={syncOrdersFromBackend}>백엔드 주문 이력 동기화</button>
                    <div className="twoCol">
                      <ul className="list">
                        {orders.slice(0, 5).map((o) => (
                          <li key={o}>{o}</li>
                        ))}
                      </ul>
                      <ul className="list">
                        {trades.slice(0, 5).map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </ShellPage>
            }
          />
          <Route
            path="/admin"
            element={
              <ShellPage title="관리자 페이지">
                <div className="stack">
                  <div className="card stack">
                    <h3>권한 기반 관리자 접근</h3>
                    <select value={adminRole} onChange={(e) => setAdminRole(e.target.value as AdminRole)}>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      <option value="OPS_ADMIN">OPS_ADMIN</option>
                      <option value="CS_ADMIN">CS_ADMIN</option>
                    </select>
                    <small>
                      SUPER_ADMIN: 전체 / OPS_ADMIN: 정산·리스크 / CS_ADMIN: KYC·공지
                    </small>
                    <div className="twoCol">
                      <input
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="OTP 코드"
                      />
                      <button onClick={verifyOtpForAdmin}>OTP 인증</button>
                    </div>
                    <small>
                      OTP 상태:{" "}
                      {otpToken && otpExpireAt && Date.now() < otpExpireAt
                        ? `인증됨 (${new Date(otpExpireAt).toLocaleTimeString()} 만료)`
                        : "미인증"}
                    </small>
                    <div className="twoCol">
                      <button
                        onClick={() =>
                          getAdminAudit(adminRole, authToken ?? undefined)
                            .then((data) => setAuditLogs(data.items.slice(0, 30)))
                            .catch(() => setUiError("감사로그 조회 실패"))
                        }
                      >
                        감사로그 동기화
                      </button>
                      <button
                        onClick={() =>
                          getAdminSettlement(adminRole, authToken ?? undefined)
                            .then((data) => setSettlementBatches(data.items))
                            .catch(() => setUiError("정산 데이터 조회 실패"))
                        }
                      >
                        정산 데이터 동기화
                      </button>
                    </div>
                  </div>
                  <div className="card">
                    <h3>대회 관리</h3>
                    <p>승인/중지/정산은 상태 전환 기반으로 테스트할 수 있습니다.</p>
                    <p>현재 대회 수: {tournaments.length}</p>
                  </div>
                  <div className="card">
                    <h3>관리자 KPI</h3>
                    <p>체결 주문 수: {adminKpi.filledCount}</p>
                    <p>접수(미체결) 로컬 표시: {adminKpi.acceptedCount}</p>
                    <p>거절 주문 수: {adminKpi.rejectedCount}</p>
                    <p>정산 순매출 합계: {adminKpi.netRevenue.toLocaleString()} USDT</p>
                  </div>
                  <div className="card stack">
                    <h3>거래소 운영</h3>
                    <p>전역 거래 정지·심볼 거래 OFF — SUPER / OPS.</p>
                    <small>
                      백엔드 상태: {adminExchangeHalted ? "정지" : "정상"} · 차단 심볼{" "}
                      {adminExchangeDisabled.length ? adminExchangeDisabled.join(", ") : "없음"}
                    </small>
                    <div className="twoCol">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await postAdminExchangeHalt(adminRole, true, authToken ?? undefined);
                            await refreshAdminExchangeStatus();
                            const pub = await getExchangePublicStatus();
                            setExchangePublicHalted(pub.halted);
                            setExchangePublicDisabled(pub.disabledSymbols);
                          } catch {
                            setUiError("거래 정지 설정 실패");
                          }
                        }}
                      >
                        플랫폼 거래 정지
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await postAdminExchangeHalt(adminRole, false, authToken ?? undefined);
                            await refreshAdminExchangeStatus();
                            const pub = await getExchangePublicStatus();
                            setExchangePublicHalted(pub.halted);
                            setExchangePublicDisabled(pub.disabledSymbols);
                          } catch {
                            setUiError("거래 재개 설정 실패");
                          }
                        }}
                      >
                        플랫폼 거래 재개
                      </button>
                    </div>
                    <div className="twoCol">
                      <input
                        value={adminSymbolToggle}
                        onChange={(e) => setAdminSymbolToggle(e.target.value.toUpperCase())}
                        placeholder="BTCUSDT"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await postAdminExchangeSymbol(
                              adminRole,
                              adminSymbolToggle.trim(),
                              false,
                              authToken ?? undefined
                            );
                            await refreshAdminExchangeStatus();
                            const pub = await getExchangePublicStatus();
                            setExchangePublicDisabled(pub.disabledSymbols);
                          } catch {
                            setUiError("심볼 거래 OFF 실패");
                          }
                        }}
                      >
                        이 심볼 거래 OFF
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await postAdminExchangeSymbol(
                              adminRole,
                              adminSymbolToggle.trim(),
                              true,
                              authToken ?? undefined
                            );
                            await refreshAdminExchangeStatus();
                            const pub = await getExchangePublicStatus();
                            setExchangePublicDisabled(pub.disabledSymbols);
                          } catch {
                            setUiError("심볼 거래 ON 실패");
                          }
                        }}
                      >
                        이 심볼 거래 ON
                      </button>
                    </div>
                    <div className="twoCol">
                      <label>
                        시뮬 중간가 USDT
                        <input
                          type="number"
                          step="any"
                          value={adminSimMidPrice}
                          onChange={(e) => setAdminSimMidPrice(e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const mid = Number(adminSimMidPrice);
                            if (!Number.isFinite(mid) || mid <= 0) {
                              setUiError("중간가를 입력하세요.");
                              return;
                            }
                            await postAdminExchangeSimMid(
                              adminRole,
                              adminSymbolToggle.trim(),
                              mid,
                              authToken ?? undefined
                            );
                            await refreshAdminExchangeStatus();
                            const pub = await getExchangePublicStatus();
                            if (pub.simMidPrices) setExchangeSimMids(pub.simMidPrices);
                          } catch {
                            setUiError("시뮬 중간가 설정 실패");
                          }
                        }}
                      >
                        위 심볼에 중간가 적용
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const r = await postAdminExchangeMatchOnce(adminRole, authToken ?? undefined);
                          setAuditLogs((prev) =>
                            [`MATCH_ONCE: touched=${r.touched} filled=${r.filled} partial=${r.partial}`, ...prev].slice(
                              0,
                              30
                            )
                          );
                          const pub = await getExchangePublicStatus();
                          if (pub.simMidPrices) setExchangeSimMids(pub.simMidPrices);
                        } catch {
                          setUiError("매칭 실행 실패");
                        }
                      }}
                    >
                      매칭 엔진 1회 실행
                    </button>
                    <button type="button" className="ghost" onClick={() => void refreshAdminExchangeStatus()}>
                      운영 상태 새로고침
                    </button>
                  </div>
                  <div className="card stack">
                    <h3>본사/하부 확장 조직</h3>
                    <form className="stack" onSubmit={createBranch}>
                      <input required name="name" placeholder="조직명" />
                      <input required name="role" placeholder="역할 (본사/지사/하부조직)" />
                      <select name="parentId">
                        <option value="">상위조직 없음(본사)</option>
                        {adminBranches.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.name}
                          </option>
                        ))}
                      </select>
                      <input
                        required
                        type="number"
                        step="0.1"
                        name="rebateRate"
                        placeholder="레퍼럴 리베이트율(%)"
                      />
                      <button type="submit">조직 추가</button>
                    </form>
                    <ul className="list">
                      {adminBranches.map((node) => (
                        <li key={node.id}>
                          <strong>
                            {node.role} - {node.name}
                          </strong>
                          <small>
                            상위조직:{" "}
                            {node.parentId
                              ? adminBranches.find((x) => x.id === node.parentId)?.name ?? "미지정"
                              : "없음"}
                          </small>
                          <small>리베이트율: {node.rebateRate}%</small>
                          <button onClick={() => toggleBranch(node.id)}>
                            {node.active ? "중지" : "활성화"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card stack">
                    <h3>수수료 정책 설정</h3>
                    <div className="twoCol">
                      <label>
                        Spot Maker(%)
                        <input
                          type="number"
                          step="0.01"
                          value={feePolicy.spotMaker}
                          onChange={(e) => updateFeePolicy("spotMaker", Number(e.target.value))}
                        />
                      </label>
                      <label>
                        Spot Taker(%)
                        <input
                          type="number"
                          step="0.01"
                          value={feePolicy.spotTaker}
                          onChange={(e) => updateFeePolicy("spotTaker", Number(e.target.value))}
                        />
                      </label>
                      <label>
                        Futures Maker(%)
                        <input
                          type="number"
                          step="0.01"
                          value={feePolicy.futuresMaker}
                          onChange={(e) => updateFeePolicy("futuresMaker", Number(e.target.value))}
                        />
                      </label>
                      <label>
                        Futures Taker(%)
                        <input
                          type="number"
                          step="0.01"
                          value={feePolicy.futuresTaker}
                          onChange={(e) => updateFeePolicy("futuresTaker", Number(e.target.value))}
                        />
                      </label>
                      <label>
                        출금 고정 수수료(USDT)
                        <input
                          type="number"
                          step="0.1"
                          value={feePolicy.withdrawFeeUsdt}
                          onChange={(e) => updateFeePolicy("withdrawFeeUsdt", Number(e.target.value))}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="card stack">
                    <h3>KYC/컴플라이언스 심사</h3>
                    {adminRole === "OPS_ADMIN" ? (
                      <small>현재 권한으로 KYC 처리 불가 (CS/SUPER 필요)</small>
                    ) : null}
                    <table>
                      <thead>
                        <tr>
                          <th>사용자</th>
                          <th>요청 등급</th>
                          <th>상태</th>
                          <th>처리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kycTickets.map((row) => (
                          <tr key={row.id}>
                            <td>{row.user}</td>
                            <td>{row.level}</td>
                            <td>{row.status}</td>
                            <td className="rowActions">
                              <button
                                disabled={adminRole === "OPS_ADMIN"}
                                onClick={() => updateKycStatus(row.id, "APPROVED")}
                              >
                                승인
                              </button>
                              <button
                                disabled={adminRole === "OPS_ADMIN"}
                                className="ghost"
                                onClick={() => updateKycStatus(row.id, "REJECTED")}
                              >
                                반려
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="card stack">
                    <h3>정산 배치 관리</h3>
                    {adminRole === "CS_ADMIN" ? (
                      <small>현재 권한으로 정산 처리 불가 (OPS/SUPER 필요)</small>
                    ) : null}
                    <table>
                      <thead>
                        <tr>
                          <th>기간</th>
                          <th>총수수료</th>
                          <th>리베이트</th>
                          <th>순매출</th>
                          <th>상태</th>
                          <th>액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settlementBatches.map((batch) => (
                          <tr key={batch.id}>
                            <td>{batch.period}</td>
                            <td>{batch.grossFeeUsdt.toLocaleString()} USDT</td>
                            <td>{batch.rebateUsdt.toLocaleString()} USDT</td>
                            <td>{batch.netRevenueUsdt.toLocaleString()} USDT</td>
                            <td>{batch.status}</td>
                            <td>
                              <button disabled={adminRole === "CS_ADMIN"} onClick={() => cycleSettlement(batch.id)}>
                                상태 진행
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="card stack">
                    <h3>리스크 엔진 룰</h3>
                    <ul className="list">
                      {riskRules.map((rule) => (
                        <li key={rule.id}>
                          <strong>{rule.name}</strong>
                          <small>임계값: {rule.threshold}</small>
                          <button disabled={adminRole === "CS_ADMIN"} onClick={() => toggleRiskRule(rule.id)}>
                            {rule.enabled ? "비활성화" : "활성화"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card stack">
                    <h3>공지/운영 배너</h3>
                    <form className="stack" onSubmit={createNotice}>
                      <input name="title" required placeholder="공지 제목" />
                      <select name="audience" defaultValue="ALL">
                        <option value="ALL">전체</option>
                        <option value="VIP">VIP</option>
                        <option value="PARTNER">파트너</option>
                      </select>
                      <button type="submit">공지 등록</button>
                    </form>
                    <ul className="list">
                      {notices.map((notice) => (
                        <li key={notice.id}>
                          <strong>{notice.title}</strong>
                          <small>대상: {notice.audience}</small>
                          <button onClick={() => toggleNotice(notice.id)}>
                            {notice.active ? "비노출" : "노출"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card stack">
                    <h3>운영 감사로그</h3>
                    <ul className="list">
                      {auditLogs.map((log) => (
                        <li key={log}>{log}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="card stack">
                    <h3>정책 변경 이력</h3>
                    <ul className="list">
                      {configChangeLogs.slice(0, 20).map((log) => (
                        <li key={log.id}>
                          <strong>
                            [{log.section}] {log.key}
                          </strong>
                          <small>
                            {log.before} -&gt; {log.after}
                          </small>
                          <small>변경자: {log.actor}</small>
                          <small>{log.at}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card stack">
                    <h3>관리자 액션 로그</h3>
                    <ul className="list">
                      {adminActionLogs.slice(0, 20).map((log) => (
                        <li key={log.id}>
                          <strong>{log.action}</strong>
                          <small>변경자: {log.actor}</small>
                          <small
                            style={{
                              fontFamily: "ui-monospace, monospace",
                              wordBreak: "break-all",
                              opacity: log.correlationId ? 1 : 0.65
                            }}
                            title={log.correlationId}
                          >
                            상관 ID: {log.correlationId ?? "—"}
                          </small>
                          <small>{log.details ?? "-"}</small>
                          <small>
                            {log.before ?? "-"} -&gt; {log.after ?? "-"}
                          </small>
                          <small>{log.at}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card stack">
                    <h3>출금 승인 센터 (OPS/SUPER)</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>User</th>
                          <th>Amount</th>
                          <th>Address</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map((w) => (
                          <tr key={w.id}>
                            <td>{w.id}</td>
                            <td>{w.userId}</td>
                            <td>{w.amount}</td>
                            <td>{w.address}</td>
                            <td>{w.status}</td>
                            <td className="rowActions">
                              <button
                                disabled={adminRole === "CS_ADMIN" || w.status !== "PENDING"}
                                onClick={() => decideWithdrawal(w.id, "APPROVED")}
                              >
                                승인
                              </button>
                              <button
                                className="ghost"
                                disabled={adminRole === "CS_ADMIN" || w.status !== "PENDING"}
                                onClick={() => decideWithdrawal(w.id, "REJECTED")}
                              >
                                거절
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="card">
                    <h3>레퍼럴 시스템</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>코드</th>
                          <th>1차 수수료율</th>
                          <th>2차 수수료율</th>
                          <th>상태</th>
                          <th>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referralRules.map((rule) => (
                          <tr key={rule.id}>
                            <td>{rule.code}</td>
                            <td>{rule.level1Rate}%</td>
                            <td>{rule.level2Rate}%</td>
                            <td>{rule.enabled ? "활성" : "중지"}</td>
                            <td>
                              <button onClick={() => toggleReferral(rule.id)}>
                                {rule.enabled ? "중지" : "활성화"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ShellPage>
            }
          />
        </Routes>
        </main>
      </div>
    </div>
  );
}

type TradePanelProps = {
  isPractice: boolean;
  setIsPractice: (value: boolean) => void;
  activeBalance: number;
  qty: number;
  setQty: (value: number) => void;
  leverage: number;
  setLeverage: (value: number) => void;
  side: OrderSide;
  setSide: (value: OrderSide) => void;
  orderType: OrderType;
  setOrderType: (value: OrderType) => void;
  limitPrice: number;
  setLimitPrice: (value: number) => void;
  estimatedCost: number;
  submitOrder: () => void;
  allowLeverage: boolean;
  orderUiMode: OrderUiMode;
  setOrderUiMode: (value: OrderUiMode) => void;
  speedQty: number;
  setSpeedQty: (value: number) => void;
  speedPrice: number;
  setSpeedPrice: (value: number) => void;
  symbol: string;
  tickSize: number;
  marketPrice: number;
  speedOpenOrders: SpeedOpenOrder[];
  onAmendLatestSpeedOrder: () => void;
  onCancelAllSpeedOrders: () => void;
  onAmendSpeedOrderById: (id: string, deltaTicks: number) => void;
  onCancelSpeedOrderById: (id: string) => void;
  speedPendingBookKey: string | null;
  speedMultiTicks: number;
  setSpeedMultiTicks: (value: number) => void;
  speedMultiCount: number;
  setSpeedMultiCount: (value: number) => void;
  placeSpeedMultiOrders: (entrySide: OrderSide) => void;
  speedMitEnabled: boolean;
  setSpeedMitEnabled: (value: boolean) => void;
  speedMitTrigger: number;
  setSpeedMitTrigger: (value: number) => void;
  speedMitOffsetTicks: number;
  setSpeedMitOffsetTicks: (value: number) => void;
  speedMitExecMode: MitExecMode;
  setSpeedMitExecMode: (value: MitExecMode) => void;
  registerMitOrder: (entrySide: OrderSide) => void;
  cancelMitOrderById: (id: string) => void;
  speedMitOrders: SpeedMitOrder[];
  speedUseOco: boolean;
  setSpeedUseOco: (value: boolean) => void;
  speedTpTicks: number;
  setSpeedTpTicks: (value: number) => void;
  speedSlTicks: number;
  setSpeedSlTicks: (value: number) => void;
  speedFills: SpeedFill[];
  speedBottomTab: "OPEN" | "FILLS";
  setSpeedBottomTab: (value: "OPEN" | "FILLS") => void;
  speedFillFilter: SpeedFillFilter;
  setSpeedFillFilter: (value: SpeedFillFilter) => void;
  speedOpenSort: SpeedListSort;
  setSpeedOpenSort: (value: SpeedListSort) => void;
  speedMitSort: SpeedListSort;
  setSpeedMitSort: (value: SpeedListSort) => void;
  speedFillSort: SpeedListSort;
  setSpeedFillSort: (value: SpeedListSort) => void;
  exportSpeedFillsCsv: () => void;
  formatKst: (iso: string) => string;
  marketGroupLabel: string;
  speedToggleConfirm: boolean;
  setSpeedToggleConfirm: (value: boolean) => void;
  speedPanelTab: SpeedPanelTab;
  setSpeedPanelTab: (value: SpeedPanelTab) => void;
  speedSummaryCollapsed: boolean;
  setSpeedSummaryCollapsed: (value: boolean) => void;
  speedFillSearch: string;
  setSpeedFillSearch: (value: string) => void;
  speedOpenWarnThreshold: number;
  setSpeedOpenWarnThreshold: (value: number) => void;
  speedMitWarnThreshold: number;
  setSpeedMitWarnThreshold: (value: number) => void;
  futuresContractMode: boolean;
};

function TradePanel({
  isPractice,
  setIsPractice,
  activeBalance,
  qty,
  setQty,
  leverage,
  setLeverage,
  side,
  setSide,
  orderType,
  setOrderType,
  limitPrice,
  setLimitPrice,
  estimatedCost,
  submitOrder,
  allowLeverage,
  orderUiMode,
  setOrderUiMode,
  speedQty,
  setSpeedQty,
  speedPrice,
  setSpeedPrice,
  symbol,
  tickSize,
  marketPrice,
  speedOpenOrders,
  onAmendLatestSpeedOrder,
  onCancelAllSpeedOrders,
  onAmendSpeedOrderById,
  onCancelSpeedOrderById,
  speedPendingBookKey,
  speedMultiTicks,
  setSpeedMultiTicks,
  speedMultiCount,
  setSpeedMultiCount,
  placeSpeedMultiOrders,
  speedMitEnabled,
  setSpeedMitEnabled,
  speedMitTrigger,
  setSpeedMitTrigger,
  speedMitOffsetTicks,
  setSpeedMitOffsetTicks,
  speedMitExecMode,
  setSpeedMitExecMode,
  registerMitOrder,
  cancelMitOrderById,
  speedMitOrders,
  speedUseOco,
  setSpeedUseOco,
  speedTpTicks,
  setSpeedTpTicks,
  speedSlTicks,
  setSpeedSlTicks,
  speedFills,
  speedBottomTab,
  setSpeedBottomTab,
  speedFillFilter,
  setSpeedFillFilter,
  speedOpenSort,
  setSpeedOpenSort,
  speedMitSort,
  setSpeedMitSort,
  speedFillSort,
  setSpeedFillSort,
  exportSpeedFillsCsv,
  formatKst,
  marketGroupLabel,
  speedToggleConfirm,
  setSpeedToggleConfirm,
  speedPanelTab,
  setSpeedPanelTab,
  speedSummaryCollapsed,
  setSpeedSummaryCollapsed,
  speedFillSearch,
  setSpeedFillSearch,
  speedOpenWarnThreshold,
  setSpeedOpenWarnThreshold,
  speedMitWarnThreshold,
  setSpeedMitWarnThreshold,
  futuresContractMode
}: TradePanelProps) {
  const speedDecimals = priceDecimalsForTick(tickSize);
  const qtyCaption = futuresContractMode ? "계약수" : "수량";
  const qtyStep = futuresContractMode ? 1 : 0.001;
  const [openVisible, setOpenVisible] = useState(5);
  const [mitVisible, setMitVisible] = useState(4);
  const [fillVisible, setFillVisible] = useState(6);
  const fillsSectionRef = useRef<HTMLUListElement | null>(null);
  const fillSearchInputRef = useRef<HTMLInputElement | null>(null);
  const confirmSpeedToggle = (msg: string) => !speedToggleConfirm || window.confirm(msg);
  const applyOco = (next: boolean) => {
    if (next === speedUseOco) return;
    if (!confirmSpeedToggle(next ? "OCO 연동을 켭니다." : "OCO 연동을 끕니다.")) return;
    setSpeedUseOco(next);
  };
  const applyMitEnabled = (next: boolean) => {
    if (next === speedMitEnabled) return;
    if (!confirmSpeedToggle(next ? "MIT 감시를 켭니다." : "MIT 감시를 끕니다.")) return;
    setSpeedMitEnabled(next);
  };
  const resetSpeedView = () => {
    setSpeedBottomTab("OPEN");
    setSpeedFillFilter("ALL");
    setSpeedOpenSort("LATEST");
    setSpeedMitSort("LATEST");
    setSpeedFillSort("LATEST");
    setOpenVisible(5);
    setMitVisible(4);
    setFillVisible(6);
    setSpeedPanelTab("ORDER");
  };
  const highlightText = (text: string, query: string) => {
    const q = query.trim();
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "ig"));
    return parts.map((part, idx) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={`${part}-${idx}`} className="fillMark">{part}</mark>
      ) : (
        <span key={`${part}-${idx}`}>{part}</span>
      )
    );
  };
  useEffect(() => {
    const onSearchShortcut = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (speedPanelTab !== "STATUS" || speedBottomTab !== "FILLS") return;
        const activeEl = document.activeElement;
        if (activeEl === fillSearchInputRef.current || speedFillSearch.trim()) {
          e.preventDefault();
          setSpeedFillSearch("");
          (activeEl as HTMLElement | null)?.blur?.();
        }
        return;
      }
      if (e.key !== "/") return;
      if (speedPanelTab !== "STATUS" || speedBottomTab !== "FILLS") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      e.preventDefault();
      fillSearchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onSearchShortcut);
    return () => window.removeEventListener("keydown", onSearchShortcut);
  }, [speedBottomTab, speedPanelTab, speedFillSearch]);
  return (
    <div className="stack">
      <div className="card twoCol">
        <button className={isPractice ? "activeBtn" : ""} onClick={() => setIsPractice(true)}>
          모의투자 계정
        </button>
        <button className={!isPractice ? "activeBtn" : ""} onClick={() => setIsPractice(false)}>
          실거래 계정
        </button>
      </div>
      <div className="card twoCol">
        <button className={orderUiMode === "BASIC" ? "activeBtn" : ""} onClick={() => setOrderUiMode("BASIC")}>
          기본 주문
        </button>
        <button className={orderUiMode === "SPEED" ? "activeBtn" : ""} onClick={() => setOrderUiMode("SPEED")}>
          스피드 주문
        </button>
      </div>
      {orderUiMode === "SPEED" ? (
        <div className="card stack speedPanel speedPanel--grid">
          <h3 className="speedSpan2">스피드 주문창</h3>
          <small className="speedSpan2">시장: {symbol} / Tick: {tickSize}</small>
          <div className="speedTabBar speedSpan2" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={speedPanelTab === "ORDER"}
              className={`speedTab ${speedPanelTab === "ORDER" ? "speedTab--active" : ""}`}
              onClick={() => setSpeedPanelTab("ORDER")}
            >
              주문
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={speedPanelTab === "AUTO"}
              className={`speedTab ${speedPanelTab === "AUTO" ? "speedTab--active" : ""}`}
              onClick={() => setSpeedPanelTab("AUTO")}
            >
              MIT·OCO
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={speedPanelTab === "STATUS"}
              className={`speedTab ${speedPanelTab === "STATUS" ? "speedTab--active" : ""}`}
              onClick={() => setSpeedPanelTab("STATUS")}
            >
              현황
            </button>
          </div>
          <div className="card speedSpan2 speedHintBar">
            단축키: F1 숏 · F2 롱 · Enter 주문실행
          </div>
          {speedPanelTab === "ORDER" ? (
            <>
              <div className="twoCol">
                <button onClick={() => setSpeedPrice(marketPrice)}>현</button>
                <button className="buyBtn" onClick={() => setOrderType("LIMIT")}>신</button>
              </div>
              <div className="twoCol">
                <button onClick={onAmendLatestSpeedOrder}>정</button>
                <button className="ghost cancelBtn" onClick={onCancelAllSpeedOrders}>취</button>
              </div>
              <div className="twoCol">
                <button className={`${side === "SHORT" ? "activeBtn" : ""} sellBtn`} onClick={() => setSide("SHORT")}>
                  F1 매도(숏)
                </button>
                <button className={`${side === "LONG" ? "activeBtn" : ""} buyBtn`} onClick={() => setSide("LONG")}>
                  F2 매수(롱)
                </button>
              </div>
              <div className="twoCol">
                <label>
                  단가
                  <input
                    type="number"
                    step={tickSize}
                    value={speedPrice}
                    onChange={(e) => setSpeedPrice(Number(e.target.value))}
                  />
                </label>
                <label>
                  {qtyCaption}
                  <input
                    type="number"
                    step={qtyStep}
                    value={speedQty}
                    onChange={(e) =>
                      setSpeedQty(
                        futuresContractMode
                          ? Math.max(1, Math.round(Number(e.target.value) || 1))
                          : Number(e.target.value)
                      )
                    }
                  />
                </label>
              </div>
              <div className="twoCol">
                <button onClick={() => setSpeedPrice(Number((speedPrice + tickSize).toFixed(speedDecimals)))}>+1틱</button>
                <button onClick={() => setSpeedPrice(Number(Math.max(tickSize, speedPrice - tickSize).toFixed(speedDecimals)))}>-1틱</button>
              </div>
              <button className="speedSpan2 buyBtn" onClick={submitOrder}>즉시 주문 실행</button>
            </>
          ) : null}
          {speedPanelTab === "AUTO" ? (
            <>
              <div className="twoCol">
                <label>
                  다중틱간격
                  <input
                    type="number"
                    min={1}
                    value={speedMultiTicks}
                    onChange={(e) => setSpeedMultiTicks(Number(e.target.value))}
                  />
                </label>
                <label>
                  다중개수
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={speedMultiCount}
                    onChange={(e) => setSpeedMultiCount(Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="twoCol">
                <button className="buyBtn" onClick={() => placeSpeedMultiOrders("LONG")}>다중 매수</button>
                <button className="ghost sellBtn" onClick={() => placeSpeedMultiOrders("SHORT")}>다중 매도</button>
              </div>
              <div className="twoCol">
                <label>
                  OCO
                  <select
                    value={speedUseOco ? "ON" : "OFF"}
                    onChange={(e) => applyOco(e.target.value === "ON")}
                  >
                    <option value="OFF">OFF</option>
                    <option value="ON">ON</option>
                  </select>
                </label>
                <label>
                  TP틱/SL틱
                  <input
                    type="text"
                    value={`${speedTpTicks}/${speedSlTicks}`}
                    onChange={(e) => {
                      const [tp, sl] = e.target.value.split("/");
                      setSpeedTpTicks(Number(tp) || 0);
                      setSpeedSlTicks(Number(sl) || 0);
                    }}
                  />
                </label>
              </div>
              <div className="twoCol">
                <label>
                  MIT ON/OFF
                  <select
                    value={speedMitEnabled ? "ON" : "OFF"}
                    onChange={(e) => applyMitEnabled(e.target.value === "ON")}
                  >
                    <option value="OFF">OFF</option>
                    <option value="ON">ON</option>
                  </select>
                </label>
                <label>
                  MIT 실행
                  <select
                    value={speedMitExecMode}
                    onChange={(e) => setSpeedMitExecMode(e.target.value as MitExecMode)}
                  >
                    <option value="MARKET">MARKET</option>
                    <option value="LIMIT">LIMIT</option>
                  </select>
                </label>
              </div>
              <div className="twoCol">
                <label>
                  MIT 트리거
                  <input type="number" step={tickSize} value={speedMitTrigger} onChange={(e) => setSpeedMitTrigger(Number(e.target.value))} />
                </label>
                <label>
                  오프셋틱
                  <input type="number" min={0} value={speedMitOffsetTicks} onChange={(e) => setSpeedMitOffsetTicks(Number(e.target.value))} />
                </label>
              </div>
              <div className="twoCol">
                <button className="buyBtn" onClick={() => registerMitOrder("LONG")}>MIT 매수 등록</button>
                <button className="ghost sellBtn" onClick={() => registerMitOrder("SHORT")}>MIT 매도 등록</button>
              </div>
              <small>MIT 대기: {speedMitOrders.length}건</small>
              <label>
                MIT 정렬
                <select value={speedMitSort} onChange={(e) => setSpeedMitSort(e.target.value as SpeedListSort)}>
                  <option value="LATEST">최신순</option>
                  <option value="PRICE_ASC">트리거 낮은순</option>
                  <option value="PRICE_DESC">트리거 높은순</option>
                </select>
              </label>
              {speedMitOrders.length > 0 ? (
                <ul className="list">
                  {speedMitOrders.slice(0, mitVisible).map((m) => (
                    <li key={m.id}>
                      <div>
                        {m.side} trg:{m.trigger} off:{m.offsetTicks}t {m.execMode} qty:{m.qty}
                      </div>
                      <button className="ghost cancelBtn" onClick={() => cancelMitOrderById(m.id)}>취소</button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {speedMitOrders.length > mitVisible ? (
                <button className="ghost" onClick={() => setMitVisible((v) => v + 4)}>MIT 더보기</button>
              ) : null}
            </>
          ) : null}
          {speedPanelTab === "STATUS" ? (
            <>
              {speedPendingBookKey ? <small>더블클릭 대기중: {speedPendingBookKey}</small> : null}
              <div className="twoCol">
                <button className={speedBottomTab === "OPEN" ? "activeBtn" : ""} onClick={() => setSpeedBottomTab("OPEN")}>
                  미체결 {speedOpenOrders.length}
                </button>
                <button className={speedBottomTab === "FILLS" ? "activeBtn" : ""} onClick={() => setSpeedBottomTab("FILLS")}>
                  체결 {speedFills.length}
                </button>
              </div>
              {speedBottomTab === "OPEN" ? (
                <>
                  <label>
                    미체결 정렬
                    <select value={speedOpenSort} onChange={(e) => setSpeedOpenSort(e.target.value as SpeedListSort)}>
                      <option value="LATEST">최신순</option>
                      <option value="PRICE_ASC">가격 낮은순</option>
                      <option value="PRICE_DESC">가격 높은순</option>
                    </select>
                  </label>
                  <ul className="list">
                    {speedOpenOrders.slice(0, openVisible).map((o) => (
                      <li key={o.id}>
                        <div>
                          {o.side} {o.qty} @ {o.price} {o.ocoRole ? `[${o.ocoRole}]` : ""}
                        </div>
                        <div className="rowActions">
                          <button className="ghost" onClick={() => onAmendSpeedOrderById(o.id, -1)}>-1틱</button>
                          <button className="ghost" onClick={() => onAmendSpeedOrderById(o.id, 1)}>+1틱</button>
                          <button className="cancelBtn" onClick={() => onCancelSpeedOrderById(o.id)}>취소</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {speedOpenOrders.length > openVisible ? (
                    <button className="ghost" onClick={() => setOpenVisible((v) => v + 5)}>미체결 더보기</button>
                  ) : null}
                </>
              ) : (
                <>
                  <label>
                    체결 필터
                    <select value={speedFillFilter} onChange={(e) => setSpeedFillFilter(e.target.value as SpeedFillFilter)}>
                      <option value="ALL">전체</option>
                      <option value="MANUAL">수동</option>
                      <option value="BOOK">호가행</option>
                      <option value="MIT">MIT</option>
                      <option value="AUTO_FILL">자동체결</option>
                    </select>
                  </label>
                  <label>
                    체결 검색
                    <input
                      ref={fillSearchInputRef}
                      value={speedFillSearch}
                      onChange={(e) => setSpeedFillSearch(e.target.value)}
                      placeholder="심볼/방향/원인 ( / 단축키 )"
                    />
                  </label>
                  <label>
                    체결 정렬
                    <select value={speedFillSort} onChange={(e) => setSpeedFillSort(e.target.value as SpeedListSort)}>
                      <option value="LATEST">최신순</option>
                      <option value="PRICE_ASC">가격 낮은순</option>
                      <option value="PRICE_DESC">가격 높은순</option>
                    </select>
                  </label>
                  <button className="ghost" onClick={exportSpeedFillsCsv}>CSV 내보내기</button>
                  <ul ref={fillsSectionRef} className="list">
                    {speedFills.slice(0, fillVisible).map((f) => (
                      <li key={f.id}>
                        [{marketGroupLabel}] {highlightText(f.symbol, speedFillSearch)} · {highlightText(formatKst(f.at), speedFillSearch)} KST · {highlightText(f.side, speedFillSearch)}{" "}
                        {highlightText(String(f.qty), speedFillSearch)} @ {highlightText(String(f.price), speedFillSearch)} ·{" "}
                        <button
                          type="button"
                          className={`fillReason fillReason--${f.reason.toLowerCase()}`}
                          onClick={() => {
                            setSpeedFillFilter(f.reason);
                            setSpeedPanelTab("STATUS");
                            setSpeedBottomTab("FILLS");
                            fillsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                          }}
                          onDoubleClick={() => setSpeedFillFilter("ALL")}
                          title="이 원인으로 필터"
                        >
                          {highlightText(f.reason, speedFillSearch)}
                        </button>
                        {f.ocoRole ? <span> · {highlightText(f.ocoRole, speedFillSearch)}</span> : null}
                      </li>
                    ))}
                  </ul>
                  {speedFills.length > fillVisible ? (
                    <button className="ghost" onClick={() => setFillVisible((v) => v + 6)}>체결 더보기</button>
                  ) : null}
                </>
              )}
            </>
          ) : null}
          <div className="card speedSpan2 speedSummaryPanel">
            <div className="rowActions">
              <strong>요약 · 필터/정렬</strong>
              <button type="button" className="ghost" onClick={() => setSpeedSummaryCollapsed(!speedSummaryCollapsed)}>
                {speedSummaryCollapsed ? "펼치기" : "접기"}
              </button>
            </div>
            {!speedSummaryCollapsed ? (
              <>
            <small>하단탭: {speedBottomTab === "OPEN" ? "미체결" : "체결"}</small>
            <small>체결필터: {speedFillFilterLabel(speedFillFilter)}</small>
            <small>체결정렬: {speedSortLabel(speedFillSort)}</small>
            <small>미체결정렬: {speedSortLabel(speedOpenSort)}</small>
            <small>MIT정렬: {speedSortLabel(speedMitSort)}</small>
            <small>
              <span className={`kpiBadge ${speedOpenOrders.length > speedOpenWarnThreshold ? "kpiWarn" : "kpiOk"}`}>
                미체결 {speedOpenOrders.length}
              </span>{" "}
              <span className={`kpiBadge ${speedMitOrders.length > speedMitWarnThreshold ? "kpiWarn" : "kpiOk"}`}>
                MIT대기 {speedMitOrders.length}
              </span>
            </small>
            <small>OCO: {speedUseOco ? "ON" : "OFF"} / TP:{speedTpTicks} SL:{speedSlTicks} · MIT감시: {speedMitEnabled ? "ON" : "OFF"}</small>
            <div className="twoCol">
              <label>
                미체결 주의기준
                <input
                  type="number"
                  min={1}
                  value={speedOpenWarnThreshold}
                  onChange={(e) => setSpeedOpenWarnThreshold(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
              <label>
                MIT 주의기준
                <input
                  type="number"
                  min={1}
                  value={speedMitWarnThreshold}
                  onChange={(e) => setSpeedMitWarnThreshold(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            </div>
            <div className="twoCol">
              <label>
                요약 필터
                <select value={speedFillFilter} onChange={(e) => setSpeedFillFilter(e.target.value as SpeedFillFilter)}>
                  <option value="ALL">전체</option>
                  <option value="MANUAL">수동</option>
                  <option value="BOOK">호가행</option>
                  <option value="MIT">MIT</option>
                  <option value="AUTO_FILL">자동체결</option>
                </select>
              </label>
              <label>
                요약 체결정렬
                <select value={speedFillSort} onChange={(e) => setSpeedFillSort(e.target.value as SpeedListSort)}>
                  <option value="LATEST">최신순</option>
                  <option value="PRICE_ASC">가격 낮은순</option>
                  <option value="PRICE_DESC">가격 높은순</option>
                </select>
              </label>
            </div>
            <div className="twoCol">
              <label>
                요약 미체결정렬
                <select value={speedOpenSort} onChange={(e) => setSpeedOpenSort(e.target.value as SpeedListSort)}>
                  <option value="LATEST">최신순</option>
                  <option value="PRICE_ASC">가격 낮은순</option>
                  <option value="PRICE_DESC">가격 높은순</option>
                </select>
              </label>
              <label>
                요약 MIT정렬
                <select value={speedMitSort} onChange={(e) => setSpeedMitSort(e.target.value as SpeedListSort)}>
                  <option value="LATEST">최신순</option>
                  <option value="PRICE_ASC">가격 낮은순</option>
                  <option value="PRICE_DESC">가격 높은순</option>
                </select>
              </label>
            </div>
            <label className="speedCheckboxRow">
              <input
                type="checkbox"
                checked={speedToggleConfirm}
                onChange={(e) => setSpeedToggleConfirm(e.target.checked)}
              />
              OCO/MIT 변경 시 확인창
            </label>
            <div className="rowActions">
              <button
                type="button"
                className={speedUseOco ? "activeBtn" : ""}
                onClick={() => applyOco(!speedUseOco)}
              >
                OCO {speedUseOco ? "끄기" : "켜기"}
              </button>
              <button
                type="button"
                className={speedMitEnabled ? "activeBtn" : ""}
                onClick={() => applyMitEnabled(!speedMitEnabled)}
              >
                MIT {speedMitEnabled ? "끄기" : "켜기"}
              </button>
            </div>
            <button type="button" className="ghost" onClick={resetSpeedView}>
              화면 필터·정렬 초기화
            </button>
              </>
            ) : (
              <small>하단탭:{speedBottomTab === "OPEN" ? "미체결" : "체결"} · 필터:{speedFillFilterLabel(speedFillFilter)} · 체결:{speedFills.length}건</small>
            )}
          </div>
        </div>
      ) : null}
      {orderUiMode === "BASIC" ? (
      <div className="card stack">
        <p>사용 가능 자산: {activeBalance.toFixed(2)} USDT</p>
        <div className="twoCol">
          <button className={side === "LONG" ? "activeBtn" : ""} onClick={() => setSide("LONG")}>
            LONG
          </button>
          <button className={side === "SHORT" ? "activeBtn" : ""} onClick={() => setSide("SHORT")}>
            SHORT
          </button>
        </div>
        <div className="twoCol">
          <button
            className={orderType === "MARKET" ? "activeBtn" : ""}
            onClick={() => setOrderType("MARKET")}
          >
            시장가
          </button>
          <button
            className={orderType === "LIMIT" ? "activeBtn" : ""}
            onClick={() => setOrderType("LIMIT")}
          >
            지정가
          </button>
        </div>
        {orderType === "LIMIT" && (
          <input
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(Number(e.target.value))}
            placeholder="지정가"
          />
        )}
        <input
          type="number"
          step={qtyStep}
          value={qty}
          onChange={(e) =>
            setQty(
              futuresContractMode
                ? Math.max(1, Math.round(Number(e.target.value) || 1))
                : Number(e.target.value)
            )
          }
          placeholder={qtyCaption}
        />
        {allowLeverage && (
          <input
            type="number"
            min={1}
            max={100}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            placeholder="레버리지"
          />
        )}
        <p>예상 증거금: {estimatedCost.toFixed(2)} USDT</p>
        <button onClick={submitOrder}>주문 실행</button>
      </div>
      ) : null}
    </div>
  );
}

export default App;
