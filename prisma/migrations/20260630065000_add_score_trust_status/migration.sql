CREATE TYPE "ScoreTrustStatus" AS ENUM ('TRUSTED', 'UNTRUSTED');

ALTER TABLE "scores"
  ADD COLUMN "trust_status" "ScoreTrustStatus" NOT NULL DEFAULT 'TRUSTED',
  ADD COLUMN "trust_reason" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3);
