-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN "loginToken" TEXT;

UPDATE "Contractor"
SET "loginToken" = 'pro_' || substr(md5(random()::text || "id"), 1, 28)
WHERE "loginToken" IS NULL;

ALTER TABLE "Contractor" ALTER COLUMN "loginToken" SET NOT NULL;

CREATE UNIQUE INDEX "Contractor_loginToken_key" ON "Contractor"("loginToken");
