import { z } from "zod";

/** 주문 생성 POST `/api/order` 본문 — 서버·클라이언트 검증 동일. */
export const orderSchema = z.object({
  userId: z.number().int().positive(),
  symbol: z.string().min(3),
  side: z.enum(["LONG", "SHORT"]),
  orderType: z.enum(["MARKET", "LIMIT"]),
  qty: z.number().positive(),
  price: z.number().positive(),
  leverage: z.number().min(1).max(100)
});

export type OrderCreateBody = z.infer<typeof orderSchema>;
