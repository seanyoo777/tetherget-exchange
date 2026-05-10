/** 거래 패널 — 기본 주문 / 스피드 주문(`SpeedOrderPanel`) 공통 타입 */

import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";

export type OrderSide = "LONG" | "SHORT";
export type OrderType = "MARKET" | "LIMIT";
export type OrderUiMode = "BASIC" | "SPEED";
export type SpeedClickMode = "ONE" | "DOUBLE";
export type MitExecMode = "MARKET" | "LIMIT";

export type SpeedOpenOrder = {
  id: string;
  side: OrderSide;
  price: number;
  qty: number;
  ocoGroup?: string;
  ocoRole?: "TP" | "SL";
};

export type SpeedFill = {
  id: string;
  at: string;
  side: OrderSide;
  symbol: string;
  price: number;
  qty: number;
  reason: "MANUAL" | "MIT" | "BOOK" | "AUTO_FILL";
  ocoRole?: "TP" | "SL";
};

export type SpeedFillFilter = "ALL" | SpeedFill["reason"];
export type SpeedListSort = "LATEST" | "PRICE_ASC" | "PRICE_DESC";
export type SpeedPanelTab = "ORDER" | "AUTO" | "STATUS";

export type CryptoOrderEntryMode = "PRICE" | "NOTIONAL";

export type CryptoAssetSummaryModel = {
  available: number;
  dailyRealized: number;
  positionEval: number;
  unrealized: number;
  myEvaluation: number;
  totalAssets: number;
};

/** 우측 패널 자산 스트립 (총자산·금일·포지션 평가) */
export type CryptoCompactSummaryModel = {
  totalAssets: number;
  dailyProfit: number;
  positionEval: number;
};

export type SpeedMitOrder = {
  id: string;
  side: OrderSide;
  trigger: number;
  offsetTicks: number;
  execMode: MitExecMode;
  qty: number;
};

export type TradePanelProps = {
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
  orderSubmitting: boolean;
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
  /** 코인(암호화폐) 거래 데스크 전용 */
  isCryptoDesk?: boolean;
  cryptoOrderEntryMode?: CryptoOrderEntryMode;
  setCryptoOrderEntryMode?: (value: CryptoOrderEntryMode) => void;
  cryptoNotionalUsdt?: number;
  setCryptoNotionalUsdt?: (value: number) => void;
  cryptoAssetSummary?: CryptoAssetSummaryModel;
  /** 코인: 자산 카드를 패널 밖(중간 스트립)으로 분리 */
  cryptoSummaryDetached?: boolean;
};

/** `TradePanel` 내부에서만 계산·주입 — 스피드 패널 전용 */
export type SpeedOrderPanelExtras = {
  speedDecimals: number;
  qtyCaption: string;
  qtyStep: number;
  applyOco: (next: boolean) => void;
  applyMitEnabled: (next: boolean) => void;
  resetSpeedView: () => void;
  highlightText: (text: string, query: string) => ReactNode;
  openVisible: number;
  setOpenVisible: Dispatch<SetStateAction<number>>;
  mitVisible: number;
  setMitVisible: Dispatch<SetStateAction<number>>;
  fillVisible: number;
  setFillVisible: Dispatch<SetStateAction<number>>;
  fillsSectionRef: RefObject<HTMLUListElement | null>;
  fillSearchInputRef: RefObject<HTMLInputElement | null>;
};

export type SpeedOrderPanelProps = TradePanelProps & SpeedOrderPanelExtras;

/** 메인 거래창(`TradePanel`)에만 전달 — 스피드 필드 제외 */
export type BasicTradePanelProps = Pick<
  TradePanelProps,
  | "activeBalance"
  | "qty"
  | "setQty"
  | "leverage"
  | "setLeverage"
  | "side"
  | "setSide"
  | "orderType"
  | "setOrderType"
  | "limitPrice"
  | "setLimitPrice"
  | "estimatedCost"
  | "submitOrder"
  | "orderSubmitting"
  | "allowLeverage"
  | "symbol"
  | "tickSize"
  | "marketPrice"
  | "futuresContractMode"
>;
