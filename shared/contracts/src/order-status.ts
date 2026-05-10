/** 거래소 주문 상태 — 프론트·백엔드·향후 서비스에서 동일 타입 사용. */
export type OrderStatus =
  | "ACCEPTED"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCEL_PENDING"
  | "CANCELLED"
  | "REJECTED";
