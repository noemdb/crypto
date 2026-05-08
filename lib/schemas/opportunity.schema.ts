import { z } from "zod";
import { MarketSnapshotSchema } from "./snapshot.schema";
import { UserConfigSchema } from "./user-config.schema";

export const ClassificationEnum = z.enum(["EXECUTABLE", "MARGINAL", "INVALID"]);
export type Classification = z.infer<typeof ClassificationEnum>;

export const OpportunityInputSchema = z.object({
  buySnapshot: MarketSnapshotSchema,
  sellSnapshot: MarketSnapshotSchema,
  capitalAmount: z.number().positive(),
  networkCostUSD: z.number().nonnegative().default(0),
  userConfig: UserConfigSchema,
  referenceTime: z.number().optional(),
});

export const TriangularOpportunityInputSchema = z.object({
  exchange: z.string(),
  snapshots: z.array(MarketSnapshotSchema).length(3),
  capitalAmount: z.number().positive(),
  userConfig: UserConfigSchema,
  referenceTime: z.number().optional(),
});

export const OpportunityStepSchema = z.object({
  platform: z.string(),
  pair: z.string(),
  price: z.number(),
  action: z.enum(["BUY", "SELL"]),
});

export const OpportunityOutputSchema = z.object({
  id: z.string().cuid2(),
  route: z.string(),
  buyPlatform: z.string(),
  sellPlatform: z.string(),
  asset: z.string(),
  buyPrice: z.number().positive(),
  sellPrice: z.number().positive(),
  capitalAmount: z.number().positive(),
  roiGross: z.number(),
  feesImpact: z.number(),
  slippageImpact: z.number(),
  networkImpact: z.number(),
  roiAdjusted: z.number(),
  fillProbability: z.number().min(0).max(1),
  liquidityRatio: z.number().min(0),
  latencyRiskMs: z.number().nonnegative(),
  classification: ClassificationEnum,
  rejectionReasons: z.array(z.string()).optional(),
  evaluatedAt: z.union([z.string().datetime(), z.number()]),
  createdAt: z.union([z.string().datetime(), z.number()]).optional(),
  snapshotAge: z.object({
    buyMs: z.number(),
    sellMs: z.number(),
    intermediateMs: z.number().optional(),
  }),
  isTriangular: z.boolean().optional(),
  triangularSteps: z.array(OpportunityStepSchema).optional(),
});

export type OpportunityInput = z.infer<typeof OpportunityInputSchema>;
export type TriangularOpportunityInput = z.infer<typeof TriangularOpportunityInputSchema>;
export type OpportunityOutput = z.infer<typeof OpportunityOutputSchema>;
export type OpportunityStep = z.infer<typeof OpportunityStepSchema>;
