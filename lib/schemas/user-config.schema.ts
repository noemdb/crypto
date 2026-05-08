import { z } from "zod";
import { PlatformEnum, AssetEnum } from "./snapshot.schema";

export const UserConfigSchema = z.object({
  id: z.string().cuid2(),
  userId: z.string(),
  minROI: z.number().min(0).max(100).default(1.5),
  capitalAmount: z.number().positive().default(500),
  maxSlippage: z.number().min(0).max(0.1).default(0.005),
  minFillProbability: z.number().min(0).max(1).default(0.7),
  alertEmail: z.string().email().optional(),
  alertTelegram: z.string().optional(),
  alertDedupeWindowMin: z.number().int().positive().default(30),
  scanIntervalSeconds: z.number().int().min(10).max(3600).default(180),
  enabledPlatforms: z.array(PlatformEnum).min(1),
  monitoredAssets: z.array(AssetEnum).min(1),
  updatedAt: z.string().datetime(),
});

export const UserConfigFormSchema = UserConfigSchema.omit({
  id: true,
  userId: true,
  updatedAt: true,
});

export type UserConfig = z.infer<typeof UserConfigSchema>;
export type UserConfigFormInput = z.infer<typeof UserConfigFormSchema>;
