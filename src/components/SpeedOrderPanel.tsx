/**
 * 스피드 주문창 — 별도 개발 후 `<SpeedOrderPanel {...tradePanelProps} />` 형태로 거래 데스크에 연결.
 * 이전 UI는 App.tsx 의 TradePanel 에 통합되어 있었음 (히스토리 참고).
 */
import type { TradePanelProps } from "../tradePanelTypes";

export function SpeedOrderPanel(_props: TradePanelProps) {
  void _props;
  return (
    <div className="card stack speedPanel">
      <h3>스피드 주문</h3>
      <p style={{ margin: 0, fontSize: 13, color: "#8b949e" }}>
        스피드 주문 모듈을 이 컴포넌트에서 구현한 뒤, 거래 우측 패널의 TradePanel 아래·옆 등 원하는 위치에 마운트하면 됩니다.
      </p>
    </div>
  );
}
