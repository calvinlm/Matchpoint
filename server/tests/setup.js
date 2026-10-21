// Runs before every test file (jest.config.js → setupFilesAfterEnv).
// Loads .env.test before anything imports the Prisma client, so tests never read .env.
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env.test'), override: true, quiet: true });

process.env.TD_JWT_SECRET = process.env.TD_JWT_SECRET || 'test-secret';

// Integration tests wipe the database. Only allow databases whose name says "test".
const url = process.env.DATABASE_URL || '';
const databaseName = url.split('?')[0].split('/').pop() || '';
if (url && !/test/i.test(databaseName)) {
  throw new Error(
    `Refusing to run tests against database "${databaseName}". ` +
      'Point DATABASE_URL in server/.env.test at a disposable database with "test" in its name.',
  );
}
