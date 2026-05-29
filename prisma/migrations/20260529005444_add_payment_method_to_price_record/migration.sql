-- DropIndex
DROP INDEX "PriceRecord_platform_asset_recordedAt_idx";

-- AlterTable
ALTER TABLE "PriceRecord" ADD COLUMN     "paymentMethod" TEXT;

-- CreateIndex
CREATE INDEX "PriceRecord_platform_asset_paymentMethod_recordedAt_idx" ON "PriceRecord"("platform", "asset", "paymentMethod", "recordedAt");
