CREATE SCHEMA IF NOT EXISTS __SCHEMA__;

CREATE TABLE IF NOT EXISTS __SCHEMA__."User" (
  "id" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "username" TEXT,
  "referralCode" TEXT,
  "referredBy" TEXT,
  "referralPointsEarned" INTEGER NOT NULL DEFAULT 0,
  "nativeBalance" INTEGER NOT NULL DEFAULT 0,
  "lockedCollateralLend" INTEGER NOT NULL DEFAULT 0,
  "points" INTEGER NOT NULL DEFAULT 0,
  "tier" TEXT NOT NULL DEFAULT 'Bronze',
  "heldLend" INTEGER NOT NULL DEFAULT 0,
  "liquidLend" INTEGER NOT NULL DEFAULT 0,
  "stakedLend" INTEGER NOT NULL DEFAULT 0,
  "claimableLend" INTEGER NOT NULL DEFAULT 0,
  "claimableStakingRewards" INTEGER NOT NULL DEFAULT 0,
  "streak" INTEGER NOT NULL DEFAULT 0,
  "creditLimitBoostBps" INTEGER NOT NULL DEFAULT 0,
  "interestDiscountBps" INTEGER NOT NULL DEFAULT 0,
  "premiumChecksAvailable" INTEGER NOT NULL DEFAULT 0,
  "badgeCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS __SCHEMA__."Challenge" (
  "id" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS __SCHEMA__."Session" (
  "token" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("token")
);

CREATE TABLE IF NOT EXISTS __SCHEMA__."OracleSnapshot" (
  "id" TEXT NOT NULL,
  "baseCurrency" TEXT NOT NULL,
  "quoteCurrency" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "sourcePath" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OracleSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS __SCHEMA__."CreditScore" (
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

CREATE TABLE IF NOT EXISTS __SCHEMA__."LoanRequest" (
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
  "onchainRequestId" TEXT,
  CONSTRAINT "LoanRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS __SCHEMA__."Loan" (
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
  "routeMode" TEXT NOT NULL DEFAULT 'preview',
  "onchainLoanId" TEXT,
  CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

ALTER TABLE __SCHEMA__."LoanRequest"
  ADD COLUMN IF NOT EXISTS "onchainRequestId" TEXT;

ALTER TABLE __SCHEMA__."Loan"
  ADD COLUMN IF NOT EXISTS "routeMode" TEXT NOT NULL DEFAULT 'preview';

ALTER TABLE __SCHEMA__."Loan"
  ADD COLUMN IF NOT EXISTS "onchainLoanId" TEXT;

CREATE TABLE IF NOT EXISTS __SCHEMA__."Activity" (
  "id" TEXT NOT NULL,
  "initiaAddress" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS __SCHEMA__."OperatorAction" (
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

CREATE TABLE IF NOT EXISTS __SCHEMA__."ReferralLink" (
  "id" TEXT NOT NULL,
  "referrerAddress" TEXT NOT NULL,
  "refereeAddress" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "pointsGenerated" INTEGER NOT NULL DEFAULT 0,
  "firstLoanRewarded" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_initiaAddress_key" ON __SCHEMA__."User" ("initiaAddress");
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON __SCHEMA__."User" ("referralCode");
CREATE INDEX IF NOT EXISTS "Session_initiaAddress_idx" ON __SCHEMA__."Session" ("initiaAddress");
CREATE INDEX IF NOT EXISTS "CreditScore_initiaAddress_scannedAt_idx" ON __SCHEMA__."CreditScore" ("initiaAddress", "scannedAt");
CREATE INDEX IF NOT EXISTS "LoanRequest_initiaAddress_submittedAt_idx" ON __SCHEMA__."LoanRequest" ("initiaAddress", "submittedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Loan_requestId_key" ON __SCHEMA__."Loan" ("requestId");
CREATE INDEX IF NOT EXISTS "Loan_initiaAddress_idx" ON __SCHEMA__."Loan" ("initiaAddress");
CREATE INDEX IF NOT EXISTS "Activity_initiaAddress_timestamp_idx" ON __SCHEMA__."Activity" ("initiaAddress", "timestamp");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralLink_refereeAddress_key" ON __SCHEMA__."ReferralLink" ("refereeAddress");
CREATE INDEX IF NOT EXISTS "ReferralLink_referrerAddress_joinedAt_idx" ON __SCHEMA__."ReferralLink" ("referrerAddress", "joinedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_initiaAddress_fkey') THEN
    ALTER TABLE __SCHEMA__."Session"
      ADD CONSTRAINT "Session_initiaAddress_fkey"
      FOREIGN KEY ("initiaAddress") REFERENCES __SCHEMA__."User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditScore_initiaAddress_fkey') THEN
    ALTER TABLE __SCHEMA__."CreditScore"
      ADD CONSTRAINT "CreditScore_initiaAddress_fkey"
      FOREIGN KEY ("initiaAddress") REFERENCES __SCHEMA__."User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditScore_oracleSnapshotId_fkey') THEN
    ALTER TABLE __SCHEMA__."CreditScore"
      ADD CONSTRAINT "CreditScore_oracleSnapshotId_fkey"
      FOREIGN KEY ("oracleSnapshotId") REFERENCES __SCHEMA__."OracleSnapshot" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoanRequest_initiaAddress_fkey') THEN
    ALTER TABLE __SCHEMA__."LoanRequest"
      ADD CONSTRAINT "LoanRequest_initiaAddress_fkey"
      FOREIGN KEY ("initiaAddress") REFERENCES __SCHEMA__."User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Loan_initiaAddress_fkey') THEN
    ALTER TABLE __SCHEMA__."Loan"
      ADD CONSTRAINT "Loan_initiaAddress_fkey"
      FOREIGN KEY ("initiaAddress") REFERENCES __SCHEMA__."User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Loan_requestId_fkey') THEN
    ALTER TABLE __SCHEMA__."Loan"
      ADD CONSTRAINT "Loan_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES __SCHEMA__."LoanRequest" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Activity_initiaAddress_fkey') THEN
    ALTER TABLE __SCHEMA__."Activity"
      ADD CONSTRAINT "Activity_initiaAddress_fkey"
      FOREIGN KEY ("initiaAddress") REFERENCES __SCHEMA__."User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReferralLink_referrerAddress_fkey') THEN
    ALTER TABLE __SCHEMA__."ReferralLink"
      ADD CONSTRAINT "ReferralLink_referrerAddress_fkey"
      FOREIGN KEY ("referrerAddress") REFERENCES __SCHEMA__."User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReferralLink_refereeAddress_fkey') THEN
    ALTER TABLE __SCHEMA__."ReferralLink"
      ADD CONSTRAINT "ReferralLink_refereeAddress_fkey"
      FOREIGN KEY ("refereeAddress") REFERENCES __SCHEMA__."User" ("initiaAddress")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
