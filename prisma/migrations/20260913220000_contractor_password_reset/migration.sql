-- CreateTable
CREATE TABLE "ContractorPasswordReset" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContractorPasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractorPasswordReset_contractorId_key" ON "ContractorPasswordReset"("contractorId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorPasswordReset_tokenHash_key" ON "ContractorPasswordReset"("tokenHash");

-- AddForeignKey
ALTER TABLE "ContractorPasswordReset" ADD CONSTRAINT "ContractorPasswordReset_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
