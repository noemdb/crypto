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
  opportunitiesLimit: z.number().int().min(1).max(200).default(50),
  enabledPlatforms: z.array(PlatformEnum).min(1),
  monitoredAssets: z.array(AssetEnum).min(1),
  updatedAt: z.string().datetime(),
  // ── Monitor de Precio P2P ────────────────────────────────────────────────
  monitorEnabled:          z.boolean().default(true),
  monitorPlatforms:        z.array(z.string()).min(1).default(['binance_p2p_ves']),
  monitorAssets:           z.array(z.string()).min(1).default(['USDT']),
  priceChangeThresholdPct: z.number().min(0.1).max(50).default(1.0),
  priceAlertThresholdPct:  z.number().min(0.5).max(100).default(2.0),
  priceAlertEnabled:       z.boolean().default(true),
});

export const UserConfigFormSchema = UserConfigSchema.omit({
  id: true,
  userId: true,
  updatedAt: true,
});

export type UserConfig = z.infer<typeof UserConfigSchema>;
export type UserConfigFormInput = z.infer<typeof UserConfigFormSchema>;
