import { formatCommaNumber } from "../lib/formatComma";
import type { CryptoCompactSummaryModel } from "../tradePanelTypes";

function valClass(v: number): string {
  if (v > 0) return "tg-strip-val tg-strip-val--up";
  if (v < 0) return "tg-strip-val tg-strip-val--down";
  return "tg-strip-val";
}

export function CryptoAssetStrip({ model }: { model: CryptoCompactSummaryModel }) {
  const { totalAssets, dailyProfit, positionEval } = model;
  return (
    <div className="tg-asset-strip" aria-label="자산 요약">
      <div className="tg-asset-strip__cell">
        <span className="tg-asset-strip__k">총자산</span>
        <span className="tg-strip-val tg-num">{formatCommaNumber(totalAssets, 4)} USDT</span>
      </div>
      <div className="tg-asset-strip__cell">
        <span className="tg-asset-strip__k">금일 수익금</span>
        <span className={`tg-num ${valClass(dailyProfit)}`}>{formatCommaNumber(dailyProfit, 4)} USDT</span>
      </div>
      <div className="tg-asset-strip__cell">
        <span className="tg-asset-strip__k">포지션 평가</span>
        <span className="tg-strip-val tg-num">{formatCommaNumber(positionEval, 4)} USDT</span>
      </div>
    </div>
  );
}
