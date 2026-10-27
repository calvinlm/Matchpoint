-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'CALLED', 'ACTIVE', 'COMPLETED', 'RETIRED');

-- AlterTable
ALTER TABLE "Bracket" ADD COLUMN     "queuePaused" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "calledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "groupIndex" INTEGER,
ADD COLUMN     "heldAt" TIMESTAMP(3),
ADD COLUMN     "manuallyOrderedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedCourtId" TEXT,
ADD COLUMN     "queueOrder" INTEGER,
ADD COLUMN     "round" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "MatchStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Match_bracketId_status_queueOrder_idx" ON "Match"("bracketId", "status", "queueOrder");

-- Backfill live state that until now only lived in memory.
-- Retired matches can't be recovered (that state was never stored), so they come back as PENDING.
UPDATE "Match"
SET "status" = 'COMPLETED', "completedAt" = "updatedAt"
WHERE "winnerId" IS NOT NULL;

UPDATE "Match"
SET "status" = 'ACTIVE', "startedAt" = COALESCE("startTime", "updatedAt")
WHERE "winnerId" IS NULL AND "courtId" IS NOT NULL;

UPDATE "Match" AS m
SET "queueOrder" = ordered.position * 1000
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "bracketId" ORDER BY "createdAt", id) AS position
  FROM "Match"
) AS ordered
WHERE m.id = ordered.id;
