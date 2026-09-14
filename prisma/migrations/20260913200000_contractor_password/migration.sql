-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "sessionToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_sessionToken_key" ON "Contractor"("sessionToken");
