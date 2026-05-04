-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "priceAsk" DOUBLE PRECISION,
    "priceBid" DOUBLE PRECISION,
    "volume24h" DOUBLE PRECISION,
    "availableLiquidity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fee" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "buyPlatform" TEXT NOT NULL,
    "sellPlatform" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "sellPrice" DOUBLE PRECISION NOT NULL,
    "capitalAmount" DOUBLE PRECISION NOT NULL,
    "roiGross" DOUBLE PRECISION NOT NULL,
    "feesImpact" DOUBLE PRECISION NOT NULL,
    "slippageImpact" DOUBLE PRECISION NOT NULL,
    "networkImpact" DOUBLE PRECISION NOT NULL,
    "roiAdjusted" DOUBLE PRECISION NOT NULL,
    "fillProbability" DOUBLE PRECISION NOT NULL,
    "liquidityRatio" DOUBLE PRECISION NOT NULL,
    "latencyRiskMs" INTEGER NOT NULL,
    "snapshotAgeBuyMs" INTEGER NOT NULL,
    "snapshotAgeSellMs" INTEGER NOT NULL,
    "classification" TEXT NOT NULL,
    "rejectionReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformStatus" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minROI" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "capitalAmount" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "maxSlippage" DOUBLE PRECISION NOT NULL DEFAULT 0.005,
    "minFillProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "alertEmail" TEXT,
    "alertTelegram" TEXT,
    "alertDedupeWindowMin" INTEGER NOT NULL DEFAULT 30,
    "enabledPlatforms" TEXT[],
    "monitoredAssets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "MarketSnapshot_platform_asset_scrapedAt_idx" ON "MarketSnapshot"("platform", "asset", "scrapedAt");

-- CreateIndex
CREATE INDEX "MarketSnapshot_scrapedAt_idx" ON "MarketSnapshot"("scrapedAt");

-- CreateIndex
CREATE INDEX "Opportunity_classification_evaluatedAt_idx" ON "Opportunity"("classification", "evaluatedAt");

-- CreateIndex
CREATE INDEX "Opportunity_route_evaluatedAt_idx" ON "Opportunity"("route", "evaluatedAt");

-- CreateIndex
CREATE INDEX "Alert_recipient_sentAt_idx" ON "Alert"("recipient", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformStatus_platform_key" ON "PlatformStatus"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "UserConfig_userId_key" ON "UserConfig"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConfig" ADD CONSTRAINT "UserConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
