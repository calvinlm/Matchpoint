-- CreateTable
CREATE TABLE "BracketSeeding" (
    "bracketId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BracketSeeding_pkey" PRIMARY KEY ("bracketId","teamId")
);

-- CreateIndex
CREATE INDEX "BracketSeeding_teamId_idx" ON "BracketSeeding"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketSeeding_bracketId_seed_key" ON "BracketSeeding"("bracketId", "seed");

-- AddForeignKey
ALTER TABLE "BracketSeeding" ADD CONSTRAINT "BracketSeeding_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSeeding" ADD CONSTRAINT "BracketSeeding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
