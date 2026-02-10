/* Seed script to upsert a sample tournament and ensure courts 1..N exist. */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const slug = process.env.SEED_TOURNAMENT_SLUG || 'sample-open-2025';
  const name = process.env.SEED_TOURNAMENT_NAME || 'Sample Open 2025';
  const plannedCourtCount = Number(process.env.SEED_PLANNED_COURTS || 6);
  const startDate = process.env.SEED_START_DATE
    ? new Date(process.env.SEED_START_DATE)
    : new Date();

  const tournament = await prisma.tournament.upsert({
    where: { slug },
    update: {
      name,
      plannedCourtCount,
      startDate,
    },
    create: {
      slug,
      name,
      plannedCourtCount,
      startDate,
      courts: {
        create: Array.from({ length: plannedCourtCount }, (_, index) => ({
          label: String(index + 1),
        })),
      },
    },
  });

  const courtData = Array.from({ length: plannedCourtCount }, (_, index) => ({
    label: String(index + 1),
    tournamentId: tournament.id,
  }));

  // Ensure all courts 1..N exist (skip duplicates for idempotency).
  await prisma.court.createMany({
    data: courtData,
    skipDuplicates: true,
  });

  console.log(
    `Seeded tournament "${tournament.name}" (${tournament.slug}) with ${plannedCourtCount} planned courts.`,
  );
}

main()
  .catch((error) => {
    console.error('Seeding error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
