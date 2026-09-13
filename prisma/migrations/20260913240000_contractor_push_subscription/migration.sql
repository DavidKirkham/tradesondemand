-- CreateTable
CREATE TABLE "ContractorPushSubscription" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractorPushSubscription_endpoint_key" ON "ContractorPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "ContractorPushSubscription_contractorId_idx" ON "ContractorPushSubscription"("contractorId");

-- AddForeignKey
ALTER TABLE "ContractorPushSubscription" ADD CONSTRAINT "ContractorPushSubscription_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
