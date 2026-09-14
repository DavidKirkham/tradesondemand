-- Stripe Connect Express: contractor recipient account + shop-earnings payouts.
-- Neon SQL (also applied by `npm run db:migrate`).

-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN "stripeConnectAccountId" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "stripeConnectOnboarded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contractor" ADD COLUMN "stripeConnectPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ContractorPayout" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "contractorId" TEXT,
    "bookingId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "shopAmountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripeTransferId" TEXT,
    "failureMessage" TEXT,
    "transferredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_stripeConnectAccountId_key" ON "Contractor"("stripeConnectAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorPayout_publicId_key" ON "ContractorPayout"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorPayout_invoiceId_key" ON "ContractorPayout"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorPayout_stripeTransferId_key" ON "ContractorPayout"("stripeTransferId");

-- CreateIndex
CREATE INDEX "ContractorPayout_contractorId_idx" ON "ContractorPayout"("contractorId");

-- CreateIndex
CREATE INDEX "ContractorPayout_bookingId_idx" ON "ContractorPayout"("bookingId");

-- CreateIndex
CREATE INDEX "ContractorPayout_status_idx" ON "ContractorPayout"("status");

-- AddForeignKey
ALTER TABLE "ContractorPayout" ADD CONSTRAINT "ContractorPayout_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorPayout" ADD CONSTRAINT "ContractorPayout_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorPayout" ADD CONSTRAINT "ContractorPayout_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
