import { useMemo } from "react";
import { calcLiquidationPrice, priceDecimalsForTick } from "../lib/trading";
import type { OrderSide, OrderType } from "../tradePanelTypes";

const LEV_MIN = 1;
const LEV_MAX = 100;

function clampLev(n: number): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return LEV_MIN;
  return Math.min(LEV_MAX, Math.max(LEV_MIN, x));
}

const PRESETS_FULL = [1, 2, 3, 5, 10, 15, 20, 25, 50, 75, 100] as const;
const PRESETS_COMPACT = [2, 5, 10, 20, 50, 100] as const;

function riskTier(leverage: number): "low" | "mid" | "high" {
  if (leverage <= 5) return "low";
  if (leverage <= 20) return "mid";
  return "high";
}

export type LeverageControlProps = {
  leverage: number;
  setLeverage: (value: number) => void;
  tickSize: number;
  side: OrderSide;
  orderType: OrderType;
  limitPrice: number;
  marketPrice: number;
  variant?: "full" | "compact";
  /** 청산가 참고용 기준가(스피드 단가 등). 없으면 지정가·시장가 규칙 사용 */
  priceBasis?: number | null;
};

export function LeverageControl({
  leverage,
  setLeverage,
  tickSize,
  side,
  orderType,
  limitPrice,
  marketPrice,
  variant = "full",
  priceBasis = null
}: LeverageControlProps) {
  const lev = clampLev(leverage);
  const tier = riskTier(lev);
  const presets = variant === "compact" ? PRESETS_COMPACT : PRESETS_FULL;

  const entryRef = useMemo(() => {
    if (priceBasis != null && Number.isFinite(priceBasis) && priceBasis > 0) {
      return priceBasis;
    }
    if (orderType === "LIMIT" && Number.isFinite(limitPrice) && limitPrice > 0) {
      return limitPrice;
    }
    return Number.isFinite(marketPrice) && marketPrice > 0 ? marketPrice : null;
  }, [priceBasis, orderType, limitPrice, marketPrice]);

  const liqPrice =
    entryRef != null && entryRef > 0 ? calcLiquidationPrice(entryRef, lev, side) : null;
  const liqDecimals = priceDecimalsForTick(tickSize);

  const tierLabel =
    tier === "low" ? "보수적" : tier === "mid" ? "중간" : "공격적";

  return (
    <div className={`tg-lev tg-lev--${variant}`}>
      <div className="tg-lev-head">
        <span className="tg-lev-title">레버리지</span>
        <span className="tg-lev-value" aria-live="polite">
          {lev}
          <span className="tg-lev-x">x</span>
        </span>
      </div>

      <div className="tg-lev-presets" role="group" aria-label="레버리지 프리셋">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            className={`tg-lev-chip ${lev === p ? "tg-lev-chip--on" : ""}`}
            onClick={() => setLeverage(p)}
          >
            {p}x
          </button>
        ))}
      </div>

      <div className="tg-lev-sliderRow">
        <input
          type="range"
          className="tg-lev-slider"
          min={LEV_MIN}
          max={LEV_MAX}
          step={1}
          value={lev}
          onChange={(e) => setLeverage(clampLev(Number(e.target.value)))}
          aria-label="레버리지 슬라이더"
        />
        <div className="tg-lev-stepper">
          <button
            type="button"
            className="tg-lev-step"
            aria-label="레버리지 1 감소"
            onClick={() => setLeverage(clampLev(lev - 1))}
          >
            −
          </button>
          <input
            type="number"
            className="tg-lev-input"
            min={LEV_MIN}
            max={LEV_MAX}
            step={1}
            value={lev}
            onChange={(e) => setLeverage(clampLev(Number(e.target.value)))}
            aria-label="레버리지 직접 입력"
          />
          <button
            type="button"
            className="tg-lev-step"
            aria-label="레버리지 1 증가"
            onClick={() => setLeverage(clampLev(lev + 1))}
          >
            +
          </button>
        </div>
      </div>

      <div className="tg-lev-meter" aria-hidden>
        <span className={`tg-lev-meterSeg tg-lev-meterSeg--low ${tier === "low" ? "tg-lev-meterSeg--active" : ""}`} />
        <span className={`tg-lev-meterSeg tg-lev-meterSeg--mid ${tier === "mid" ? "tg-lev-meterSeg--active" : ""}`} />
        <span className={`tg-lev-meterSeg tg-lev-meterSeg--high ${tier === "high" ? "tg-lev-meterSeg--active" : ""}`} />
      </div>
      <p className="tg-lev-riskNote">
        위험도: <strong className={`tg-lev-tier tg-lev-tier--${tier}`}>{tierLabel}</strong>
        {variant === "full" ? (
          <span className="tg-lev-riskHint"> · 레버리지가 높을수록 변동에 민감합니다.</span>
        ) : null}
      </p>

      {liqPrice != null ? (
        <p className="tg-lev-liq">
          참고 청산가 ({side === "LONG" ? "롱" : "숏"}, 모델):{" "}
          <strong>
            {liqPrice.toLocaleString(undefined, {
              minimumFractionDigits: Math.min(liqDecimals, 8),
              maximumFractionDigits: Math.min(liqDecimals, 8)
            })}
          </strong>
        </p>
      ) : null}
      {variant === "full" ? (
        <p className="tg-lev-disclaimer">
          청산가는 단순 유지증거금 모델 기준이며, 실제 거래소·종목 규칙과 다를 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}
