import { z } from "zod";

export const haltBodySchema = z.object({ halted: z.boolean() });

export const symbolToggleSchema = z.object({
  symbol: z.string().min(3),
  enabled: z.boolean()
});

export const simMidSchema = z.object({
  symbol: z.string().min(3),
  midUsdt: z.number().positive()
});

export type ExchangeHaltBody = z.infer<typeof haltBodySchema>;
export type ExchangeSymbolToggleBody = z.infer<typeof symbolToggleSchema>;
export type ExchangeSimMidBody = z.infer<typeof simMidSchema>;
