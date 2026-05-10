import { z } from "zod";

export const withdrawalRequestSchema = z.object({
  userId: z.number().int().positive(),
  amount: z.number().positive(),
  address: z.string().min(10)
});

export type WithdrawalRequestBody = z.infer<typeof withdrawalRequestSchema>;
