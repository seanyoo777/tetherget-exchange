import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MarketGroupKey } from "../lib/marketPrefs";
import { fetchBitgetMixUsdtAllTickers, type BitgetMixTickerBrief } from "../lib/bitgetTickers";
import { fetchYahooDayChangePct } from "../lib/yahooDayChange";
import { TradingViewEmbed } from "./TradingViewEmbed";
import { tradingViewSymbol } from "../lib/tradingViewSymbol";
import "../styles/homeDashboard.css";

type RankingRow = {
  user: string;
  roi: number;
  pnl: number;
  trades: number;
  winRate: number;
};

type HomePageProps = {
  trades: string[];
  ranking: RankingRow[];
  setMarketGroup: (g: MarketGroupKey) => void;
  setSymbol: (s: string) => void;
};

type MacroPct = { nq: number | null; gc: number | null };

const CRYPTO_LIST = [
  { label: "BTC", sym: "BTCUSDT" },
  { label: "ETH", sym: "ETHUSDT" },
  { label: "SOL", sym: "SOLUSDT" },
  { label: "XRP", sym: "XRPUSDT" },
  { label: "DOGE", sym: "DOGEUSDT" }
] as const;

const MARKET_CARDS: Array<{
  title: string;
  path: "/exchange" | "/simulation" | "/tournament";
  marketGroup: MarketGroupKey;
  repSymbol: string;
}> = [
  { title: "코인선물", path: "/exchange", marketGroup: "CRYPTO", repSymbol: "BTCUSDT" },
  { title: "해외주식", path: "/exchange", marketGroup: "US_STOCKS", repSymbol: "NVDA" },
  { title: "국내주식", path: "/exchange", marketGroup: "KR_STOCKS", repSymbol: "005930.KS" },
  { title: "해외선물", path: "/exchange", marketGroup: "US_FUTURES", repSymbol: "NQ=F" },
  { title: "국내선물", path: "/exchange", marketGroup: "KR_FUTURES", repSymbol: "KOSPI200F" },
  { title: "모의투자", path: "/simulation", marketGroup: "CRYPTO", repSymbol: "BTCUSDT" },
  { title: "대회", path: "/tournament", marketGroup: "CRYPTO", repSymbol: "BTCUSDT" }
];

function fmtVol(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function HomePage({ trades, ranking, setMarketGroup, setSymbol }: HomePageProps) {
  const navigate = useNavigate();
  const [cryptoMap, setCryptoMap] = useState<Map<string, BitgetMixTickerBrief>>(new Map());
  const [macro, setMacro] = useState<MacroPct>({ nq: null, gc: null });
  const [yahooExtras, setYahooExtras] = useState<Partial<Record<string, { changePct: number; vol?: number }>>>({});

  const pullAll = useCallback(async () => {
    try {
      const map = await fetchBitgetMixUsdtAllTickers();
      setCryptoMap(map);
    } catch {
      setCryptoMap(new Map());
    }
    try {
      const [nq, gc] = await Promise.all([
        fetchYahooDayChangePct("NQ=F"),
        fetchYahooDayChangePct("GC=F")
      ]);
      setMacro({
        nq: nq?.changePct ?? null,
        gc: gc?.changePct ?? null
      });
    } catch {
      setMacro({ nq: null, gc: null });
    }
    try {
      const reps = ["NVDA", "005930.KS", "KOSPI200F"] as const;
      const outs = await Promise.all(reps.map((s) => fetchYahooDayChangePct(s)));
      setYahooExtras((prev) => {
        const next = { ...prev };
        reps.forEach((s, i) => {
          const o = outs[i];
          if (o) next[s] = { changePct: o.changePct };
        });
        return next;
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void pullAll();
    const id = window.setInterval(() => void pullAll(), 8000);
    return () => window.clearInterval(id);
  }, [pullAll]);

  const btcBrief = cryptoMap.get("BTCUSDT");
  const btcTv = tradingViewSymbol("CRYPTO", "BTCUSDT");

  const tickerSegments = useMemo(() => {
    const cryptoItems = CRYPTO_LIST.map(({ label, sym }) => {
      const row = cryptoMap.get(sym);
      const chg = row?.change24hPct ?? null;
      return (
        <span key={sym} className="tg-home-ticker-item">
          <strong>{label}</strong>
          <span className={`chg ${chg != null && chg >= 0 ? "chg--up" : "chg--down"}`}>
            {chg != null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%` : "—"}
          </span>
        </span>
      );
    });
    const macroItems = (
      <>
        <span className="tg-home-ticker-item">
          <strong>NASDAQ</strong>
          <span
            className={`chg ${macro.nq != null && macro.nq >= 0 ? "chg--up" : "chg--down"}`}
          >
            {macro.nq != null ? `${macro.nq >= 0 ? "+" : ""}${macro.nq.toFixed(1)}%` : "—"}
          </span>
        </span>
        <span className="tg-home-ticker-item">
          <strong>GOLD</strong>
          <span
            className={`chg ${macro.gc != null && macro.gc >= 0 ? "chg--up" : "chg--down"}`}
          >
            {macro.gc != null ? `${macro.gc >= 0 ? "+" : ""}${macro.gc.toFixed(1)}%` : "—"}
          </span>
        </span>
      </>
    );
    const inner = (
      <>
        {cryptoItems}
        {macroItems}
      </>
    );
    return (
      <>
        <div className="tg-home-ticker-dup" aria-hidden>
          {inner}
        </div>
        <div className="tg-home-ticker-dup">{inner}</div>
      </>
    );
  }, [cryptoMap, macro.gc, macro.nq]);

  const openDesk = (marketGroup: MarketGroupKey, symbol: string, path: "/exchange" | "/simulation" | "/tournament") => {
    setMarketGroup(marketGroup);
    setSymbol(symbol);
    navigate(path);
  };

  const cardMetrics = (rep: string, mg: MarketGroupKey) => {
    if (mg === "CRYPTO") {
      const row = cryptoMap.get(rep.toUpperCase());
      return {
        chg: row?.change24hPct ?? null,
        vol: row?.baseVolume ?? null
      };
    }
    if (mg === "US_FUTURES" && rep === "NQ=F") {
      return { chg: macro.nq, vol: null as number | null };
    }
    const y = yahooExtras[rep];
    if (y) return { chg: y.changePct, vol: null as number | null };
    return { chg: null as number | null, vol: null as number | null };
  };

  const activityLines = useMemo(() => {
    const lines: string[] = [];
    trades.slice(0, 5).forEach((t) => lines.push(t));
    ranking.slice(0, 3).forEach((r, i) => lines.push(`수익률 TOP ${i + 1} · ${r.user} · ROI ${r.roi >= 0 ? "+" : ""}${r.roi.toFixed(1)}%`));
    const hot = ["BTCUSDT", "ETHUSDT", "SOLUSDT"].find((s) => {
      const ch = cryptoMap.get(s)?.change24hPct;
      return ch != null && Math.abs(ch) >= 3;
    });
    if (hot) {
      const ch = cryptoMap.get(hot)?.change24hPct;
      lines.push(`${hot} 변동 ${ch != null ? `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%` : "—"} · 주목`);
    }
    return lines.slice(0, 12);
  }, [trades, ranking, cryptoMap]);

  const apiLive = cryptoMap.size > 0;

  return (
    <section className="tg-home" aria-label="TGX 시장 대시보드">
      <div className="tg-home-ticker-wrap">
        <div className="tg-home-ticker" role="presentation">
          {tickerSegments}
        </div>
      </div>

      <div className="tg-home-hero">
        <div className="tg-home-hero-chart">
          <div className="tg-home-hero-head">
            <div>
              <div className="tg-home-hero-pair">BTCUSDT · 무기한 USDT-M</div>
              <div className="tg-home-hero-price">
                {btcBrief != null
                  ? btcBrief.lastPr.toLocaleString(undefined, { maximumFractionDigits: btcBrief.lastPr >= 1000 ? 2 : 4 })
                  : "—"}
              </div>
            </div>
            <div className="tg-home-hero-meta">
              <span>
                24h 변동{" "}
                <b className={btcBrief != null && btcBrief.change24hPct >= 0 ? "tg-chg--up" : "tg-chg--down"}>
                  {btcBrief != null
                    ? `${btcBrief.change24hPct >= 0 ? "+" : ""}${btcBrief.change24hPct.toFixed(2)}%`
                    : "—"}
                </b>
              </span>
              <span>
                24h 거래량(베이스) <b>{fmtVol(btcBrief?.baseVolume)}</b>
              </span>
              <span className={`tg-home-status-pill ${apiLive ? "tg-home-status-pill--live" : "tg-home-status-pill--wait"}`}>
                시세 {apiLive ? "실시간(Bitget)" : "연결 대기"}
              </span>
            </div>
          </div>
          <div className="tg-home-chart-inner">
            {btcTv ? (
              <TradingViewEmbed tvSymbol={btcTv} interval="15" />
            ) : (
              <div className="tg-chart-placeholder" role="status">
                차트 심볼을 불러오지 못했습니다.
              </div>
            )}
          </div>
        </div>

        <aside className="tg-home-hero-aside">
          <h3>빠른 시작</h3>
          <div className="tg-home-quick">
            <button
              type="button"
              className="tg-home-btn tg-home-btn--primary"
              onClick={() => openDesk("CRYPTO", "BTCUSDT", "/exchange")}
            >
              거래 시작 · BTCUSDT
            </button>
            <div className="tg-home-quick-row">
              <button type="button" className="tg-home-btn" onClick={() => openDesk("CRYPTO", "BTCUSDT", "/exchange")}>
                코인선물
              </button>
              <button type="button" className="tg-home-btn" onClick={() => openDesk("US_STOCKS", "NVDA", "/exchange")}>
                해외주식
              </button>
              <button type="button" className="tg-home-btn" onClick={() => openDesk("KR_STOCKS", "005930.KS", "/exchange")}>
                국내주식
              </button>
              <button type="button" className="tg-home-btn" onClick={() => openDesk("US_FUTURES", "NQ=F", "/exchange")}>
                해외선물
              </button>
              <button type="button" className="tg-home-btn" onClick={() => openDesk("CRYPTO", "BTCUSDT", "/simulation")}>
                모의투자
              </button>
              <Link to="/tournament" className="tg-home-btn tg-home-btn--ghost">
                수익률 대회
              </Link>
            </div>
            <p className="tg-home-auth-hint">
              로그인 후 실계정 주문·출금·관리자 연동이 활성화됩니다.{" "}
              <Link to="/auth">로그인 · 회원가입</Link>
            </p>
          </div>
        </aside>
      </div>

      <div className="tg-home-cards">
        {MARKET_CARDS.map((c) => {
          const { chg, vol } = cardMetrics(c.repSymbol, c.marketGroup);
          return (
            <Link
              key={c.title + c.path}
              to={c.path}
              className="tg-home-card"
              onClick={() => {
                setMarketGroup(c.marketGroup);
                setSymbol(c.repSymbol);
              }}
            >
              <div className="tg-home-card-title">{c.title}</div>
              <div className="tg-home-card-sym">{c.repSymbol}</div>
              <div className="tg-home-card-row">
                <span>24h</span>
                <span className={chg != null && chg >= 0 ? "chg--up" : "chg--down"}>
                  {chg != null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                </span>
              </div>
              <div className="tg-home-card-row">
                <span>거래량</span>
                <span>{fmtVol(vol)}</span>
              </div>
              <span className="tg-home-card-cta">바로가기 →</span>
            </Link>
          );
        })}
      </div>

      <div className="tg-home-bottom">
        <div className="tg-home-panel">
          <h4>최근 체결 · 활동</h4>
          <ul>
            {activityLines.length === 0 ? (
              <li className="tg-muted">표시할 체결 로그가 없습니다. 거래소에서 주문해 보세요.</li>
            ) : (
              activityLines.map((line, i) => <li key={`act-${i}`}>{line}</li>)
            )}
          </ul>
        </div>
        <div className="tg-home-panel">
          <h4>수익률 랭킹</h4>
          <ul>
            {ranking.slice(0, 5).map((r, i) => (
              <li key={r.user} className="tg-home-rank">
                #{i + 1} {r.user} · ROI {r.roi >= 0 ? "+" : ""}
                {r.roi.toFixed(1)}% · 손익 {r.pnl >= 0 ? "+" : ""}
                {r.pnl} USDT
              </li>
            ))}
          </ul>
        </div>
        <div className="tg-home-panel">
          <h4>시장 요약</h4>
          <ul>
            <li>BTC 페어 시세 Bitget USDT-M 선물 기준</li>
            <li>주식·선물 지표는 Yahoo Finance 지연 시세를 사용할 수 있습니다.</li>
            <li>
              <button type="button" className="tg-home-btn tg-home-btn--primary" onClick={() => openDesk("CRYPTO", "BTCUSDT", "/exchange")}>
                거래소 열기
              </button>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
