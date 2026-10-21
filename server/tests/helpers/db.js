const prisma = require('../../src/lib/prisma');

// Empties every application table. tests/setup.js guarantees this only runs on a *test* database.
async function resetDatabase() {
  const rows = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (rows.length === 0) {
    return;
  }
  const tables = rows.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

module.exports = { prisma, resetDatabase };
