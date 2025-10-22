const dotenv = require('dotenv');
const prisma = require('../src/lib/prisma');

// Load .env.test first (if present), then fall back to default .env
dotenv.config({ path: '.env.test', override: true });
dotenv.config();

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Create a .env.test file or export DATABASE_URL before running tests.'
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    throw new Error(
      `Cannot connect to database defined by DATABASE_URL (${process.env.DATABASE_URL}). Ensure the Postgres test instance is running.\n${error}`
    );
  }
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AuditLog","MatchAdvancement","Registration","Standing","Match","TeamPlayer","Team","Player","Division","Court","Tournament" CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
