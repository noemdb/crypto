-- Migration manual: add_price_records_and_monitor_config
-- Aplicada con prisma db execute (bypasa drift de migration history)

-- AlterTable
ALTER TABLE "UserConfig" ADD COLUMN     "monitorAssets" TEXT[] DEFAULT ARRAY['USDT']::TEXT[],
ADD COLUMN     "monitorEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "monitorPlatforms" TEXT[] DEFAULT ARRAY['binance_p2p_ves']::TEXT[],
ADD COLUMN     "priceAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priceAlertThresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
ADD COLUMN     "priceChangeThresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

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

-- CreateIndex
CREATE INDEX "PriceRecord_platform_asset_recordedAt_idx" ON "PriceRecord"("platform", "asset", "recordedAt");

-- CreateIndex
CREATE INDEX "PriceRecord_recordedAt_idx" ON "PriceRecord"("recordedAt");
