-- CreateEnum
CREATE TYPE "AdvancementPlacement" AS ENUM ('WINNER', 'LOSER');

-- CreateTable
CREATE TABLE "MatchAdvancement" (
    "id" TEXT NOT NULL,
    "fromMatchId" TEXT NOT NULL,
    "toMatchId" TEXT NOT NULL,
    "placement" "AdvancementPlacement" NOT NULL,
    "slot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchAdvancement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchAdvancement_toMatchId_idx" ON "MatchAdvancement"("toMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchAdvancement_fromMatchId_placement_key" ON "MatchAdvancement"("fromMatchId", "placement");

-- CreateIndex
CREATE UNIQUE INDEX "MatchAdvancement_toMatchId_placement_slot_key" ON "MatchAdvancement"("toMatchId", "placement", "slot");

-- AddForeignKey
ALTER TABLE "MatchAdvancement" ADD CONSTRAINT "MatchAdvancement_fromMatchId_fkey" FOREIGN KEY ("fromMatchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAdvancement" ADD CONSTRAINT "MatchAdvancement_toMatchId_fkey" FOREIGN KEY ("toMatchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
