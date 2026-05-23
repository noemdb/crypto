-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_opportunityId_fkey";

-- AlterTable
ALTER TABLE "MarketSnapshot" ALTER COLUMN "scrapedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Opportunity" ALTER COLUMN "evaluatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "PlatformStatus" ALTER COLUMN "lastSuccessAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "lastErrorAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "UserConfig" ADD COLUMN     "bankingAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bcvAlertOnChange" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bcvChangeThresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "intelAlertMinScore" DOUBLE PRECISION NOT NULL DEFAULT 0.70,
ADD COLUMN     "intelEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "monitorAssets" TEXT[] DEFAULT ARRAY['USDT']::TEXT[],
ADD COLUMN     "monitorEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "monitorPlatforms" TEXT[] DEFAULT ARRAY['binance_p2p_ves']::TEXT[],
ADD COLUMN     "opportunitiesLimit" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "priceAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priceAlertThresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
ADD COLUMN     "priceChangeThresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "scanIntervalSeconds" INTEGER NOT NULL DEFAULT 180;

-- CreateTable
CREATE TABLE "PriceRecord" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "priceMin" DOUBLE PRECISION NOT NULL,
    "priceMax" DOUBLE PRECISION NOT NULL,
    "priceMid" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BCVRate" (
    "id" TEXT NOT NULL,
    "rateUsd" DOUBLE PRECISION NOT NULL,
    "rateEur" DOUBLE PRECISION,
    "date" TEXT NOT NULL,
    "changePct" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUrl" TEXT NOT NULL,

    CONSTRAINT "BCVRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelSignal" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceLayer" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "confirmedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alerted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IntelSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankingWindow" (
    "id" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "windowType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "keywords" TEXT[],
    "sourceUrl" TEXT NOT NULL,
    "signalId" TEXT,

    CONSTRAINT "BankingWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceRecord_platform_asset_recordedAt_idx" ON "PriceRecord"("platform", "asset", "recordedAt");

-- CreateIndex
CREATE INDEX "PriceRecord_recordedAt_idx" ON "PriceRecord"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BCVRate_date_key" ON "BCVRate"("date");

-- CreateIndex
CREATE INDEX "BCVRate_date_idx" ON "BCVRate"("date");

-- CreateIndex
CREATE INDEX "BCVRate_collectedAt_idx" ON "BCVRate"("collectedAt");

-- CreateIndex
CREATE INDEX "IntelSignal_signalType_detectedAt_idx" ON "IntelSignal"("signalType", "detectedAt");

-- CreateIndex
CREATE INDEX "IntelSignal_score_detectedAt_idx" ON "IntelSignal"("score", "detectedAt");

-- CreateIndex
CREATE INDEX "IntelSignal_expiresAt_idx" ON "IntelSignal"("expiresAt");

-- CreateIndex
CREATE INDEX "BankingWindow_bank_isActive_idx" ON "BankingWindow"("bank", "isActive");

-- CreateIndex
CREATE INDEX "BankingWindow_detectedAt_idx" ON "BankingWindow"("detectedAt");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
