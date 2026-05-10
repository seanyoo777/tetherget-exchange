import { formatCommaNumber } from "../lib/formatComma";
import type { CryptoAssetSummaryModel } from "../tradePanelTypes";

function signedClass(v: number): string {
  if (v > 0) return "tg-crypto-sum__v tg-crypto-sum__v--up";
  if (v < 0) return "tg-crypto-sum__v tg-crypto-sum__v--down";
  return "tg-crypto-sum__v";
}

export function CryptoAssetSummary({ model }: { model: CryptoAssetSummaryModel }) {
  const {
    available,
    dailyRealized,
    positionEval,
    unrealized,
    myEvaluation,
    totalAssets
  } = model;

  const rows: { k: string; v: string; valClass?: string }[] = [
    { k: "사용가능 자산", v: `${formatCommaNumber(available, 4)} USDT` },
    {
      k: "금일 수익실현",
      v: `${formatCommaNumber(dailyRealized, 4)} USDT`,
      valClass: signedClass(dailyRealized)
    },
    {
      k: "현재 포지션 평가금액",
      v: `${formatCommaNumber(positionEval, 4)} USDT`
    },
    {
      k: "미실현 손익",
      v: `${formatCommaNumber(unrealized, 4)} USDT`,
      valClass: signedClass(unrealized)
    },
    {
      k: "내 평가금액",
      v: `${formatCommaNumber(myEvaluation, 4)} USDT`
    },
    {
      k: "내 총자산",
      v: `${formatCommaNumber(totalAssets, 4)} USDT`
    }
  ];

  return (
    <div className="tg-crypto-summary card" aria-label="자산 요약">
      <div className="tg-crypto-summary__head">자산 요약</div>
      <dl className="tg-crypto-sum-list">
        {rows.map((row) => (
          <div key={row.k} className="tg-crypto-sum-row">
            <dt>{row.k}</dt>
            <dd className={row.valClass ?? "tg-crypto-sum__v"}>{row.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
