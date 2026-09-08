-- CreateTable
CREATE TABLE "fx_rate" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'live',

    CONSTRAINT "fx_rate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fx_rate_baseCurrency_fetchedAt_idx" ON "fx_rate"("baseCurrency", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rate_baseCurrency_quoteCurrency_key" ON "fx_rate"("baseCurrency", "quoteCurrency");
