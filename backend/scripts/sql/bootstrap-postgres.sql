CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "username" TEXT,
  "referralCode" TEXT,
  "referredBy" TEXT,
  "referralPointsEarned" INTEGER NOT NULL DEFAULT 0,
  "nativeBalance" INTEGER NOT NULL DEFAULT 0,
  "lockedCollateralLend" INTEGER NOT NULL DEFAULT 0,
  "points" INTEGER NOT NULL,
  "tier" TEXT NOT NULL,
  "heldLend" INTEGER NOT NULL,
  "liquidLend" INTEGER NOT NULL DEFAULT 0,
  "stakedLend" INTEGER NOT NULL DEFAULT 0,
  "claimableLend" INTEGER NOT NULL DEFAULT 0,
  "claimableStakingRewards" INTEGER NOT NULL DEFAULT 0,
  "streak" INTEGER NOT NULL,
  "creditLimitBoostBps" INTEGER NOT NULL DEFAULT 0,
  "interestDiscountBps" INTEGER NOT NULL DEFAULT 0,
  "premiumChecksAvailable" INTEGER NOT NULL DEFAULT 0,
  "badgeCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Challenge" (
  "id" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
  "token" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("token")
);

CREATE TABLE IF NOT EXISTS "OracleSnapshot" (
  "id" TEXT NOT NULL,
  "baseCurrency" TEXT NOT NULL,
  "quoteCurrency" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "sourcePath" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OracleSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreditScore" (
  "id" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "limitUsd" INTEGER NOT NULL,
  "risk" TEXT NOT NULL,
  "apr" DOUBLE PRECISION NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "summary" TEXT,
  "signalsJson" TEXT,
  "scannedAt" TIMESTAMP(3) NOT NULL,
  "breakdownJson" TEXT NOT NULL,
  "oracleSnapshotId" TEXT,
  CONSTRAINT "CreditScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LoanRequest" (
  "id" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "collateralAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "merchantId" TEXT,
  "merchantCategory" TEXT,
  "merchantAddress" TEXT,
  "assetSymbol" TEXT NOT NULL,
  "tenorMonths" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL,
  "txHash" TEXT,
  CONSTRAINT "LoanRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Loan" (
  "id" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "principal" DOUBLE PRECISION NOT NULL,
  "collateralAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "merchantId" TEXT,
  "merchantCategory" TEXT,
  "merchantAddress" TEXT,
  "collateralStatus" TEXT NOT NULL DEFAULT 'none',
  "apr" DOUBLE PRECISION NOT NULL,
  "tenorMonths" INTEGER NOT NULL,
  "installmentsPaid" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "scheduleJson" TEXT NOT NULL,
  "txHashApprove" TEXT,
  CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Activity" (
  "id" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperatorAction" (
  "id" TEXT NOT NULL,
  "actorAddress" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "txHash" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperatorAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralLink" (
  "id" TEXT NOT NULL,
  "referrerAddress" TEXT NOT NULL,
  "refereeAddress" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "pointsGenerated" INTEGER NOT NULL DEFAULT 0,
  "firstLoanRewarded" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_initiaAddress_key" ON "User" ("initiaAddress");
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User" ("referralCode");
CREATE INDEX IF NOT EXISTS "Session_initiaAddress_idx" ON "Session" ("initiaAddress");
CREATE INDEX IF NOT EXISTS "CreditScore_initiaAddress_scannedAt_idx" ON "CreditScore" ("initiaAddress", "scannedAt");
CREATE INDEX IF NOT EXISTS "LoanRequest_initiaAddress_submittedAt_idx" ON "LoanRequest" ("initiaAddress", "submittedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Loan_requestId_key" ON "Loan" ("requestId");
CREATE INDEX IF NOT EXISTS "Loan_initiaAddress_idx" ON "Loan" ("initiaAddress");
CREATE INDEX IF NOT EXISTS "Activity_initiaAddress_timestamp_idx" ON "Activity" ("initiaAddress", "timestamp");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralLink_refereeAddress_key" ON "ReferralLink" ("refereeAddress");
CREATE INDEX IF NOT EXISTS "ReferralLink_referrerAddress_joinedAt_idx" ON "ReferralLink" ("referrerAddress", "joinedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_initiaAddress_fkey') THEN
    ALTER TABLE "Session"
      ADD CONSTRAINT "Session_initiaAddress_fkey"
      FOREIGN KEY ("initiaAddress") REFERENCES "User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditScore_initiaAddress_fkey') THEN
    ALTER TABLE "CreditScore"
      ADD CONSTRAINT "CreditScore_initiaAddress_fkey"
      FOREIGN KEY ("initiaAddress") REFERENCES "User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditScore_oracleSnapshotId_fkey') THEN
    ALTER TABLE "CreditScore"
      ADD CONSTRAINT "CreditScore_oracleSnapshotId_fkey"
      FOREIGN KEY ("oracleSnapshotId") REFERENCES "OracleSnapshot" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoanRequest_initiaAddress_fkey') THEN
    ALTER TABLE "LoanRequest"
      ADD CONSTRAINT "LoanRequest_initiaAddress_fkey"
      FOREIGN KEY ("initiaAddress") REFERENCES "User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Loan_initiaAddress_fkey') THEN
    ALTER TABLE "Loan"
      ADD CONSTRAINT "Loan_initiaAddress_fkey"
      FOREIGN KEY ("initiaAddress") REFERENCES "User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Loan_requestId_fkey') THEN
    ALTER TABLE "Loan"
      ADD CONSTRAINT "Loan_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "LoanRequest" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Activity_initiaAddress_fkey') THEN
    ALTER TABLE "Activity"
      ADD CONSTRAINT "Activity_initiaAddress_fkey"
      FOREIGN KEY ("initiaAddress") REFERENCES "User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReferralLink_referrerAddress_fkey') THEN
    ALTER TABLE "ReferralLink"
      ADD CONSTRAINT "ReferralLink_referrerAddress_fkey"
      FOREIGN KEY ("referrerAddress") REFERENCES "User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReferralLink_refereeAddress_fkey') THEN
    ALTER TABLE "ReferralLink"
      ADD CONSTRAINT "ReferralLink_refereeAddress_fkey"
      FOREIGN KEY ("refereeAddress") REFERENCES "User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
