import type { SpeedFillFilter, SpeedListSort } from "../tradePanelTypes";

export function speedFillFilterLabel(f: SpeedFillFilter): string {
  switch (f) {
    case "ALL":
      return "전체";
    case "MANUAL":
      return "수동";
    case "BOOK":
      return "호가행";
    case "MIT":
      return "MIT";
    case "AUTO_FILL":
      return "자동체결";
    default:
      return f;
  }
}

export function speedSortLabel(s: SpeedListSort): string {
  switch (s) {
    case "LATEST":
      return "최신순";
    case "PRICE_ASC":
      return "가격 낮은순";
    case "PRICE_DESC":
      return "가격 높은순";
    default:
      return s;
  }
}
