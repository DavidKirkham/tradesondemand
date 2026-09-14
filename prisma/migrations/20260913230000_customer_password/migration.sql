-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Customer" ADD COLUMN "sessionToken" TEXT;
ALTER TABLE "Customer" ADD COLUMN "resetCodeHash" TEXT;
ALTER TABLE "Customer" ADD COLUMN "resetCodeExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_sessionToken_key" ON "Customer"("sessionToken");
