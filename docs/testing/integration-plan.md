## Integration Testing Plan — Tournament API

This document outlines how to validate the tournament CRUD endpoints with automated integration tests using Jest and Supertest.

### 1. Tooling Setup
- Install dependencies:
  ```bash
  npm install --save-dev jest supertest
  ```
- Update `package.json` scripts:
  ```json
  {
    "scripts": {
      "test": "cross-env NODE_ENV=test jest --runInBand"
    }
  }
  ```
- If cross-platform support is required, add `cross-env`:
  ```bash
  npm install --save-dev cross-env
  ```

### 2. Jest Configuration
- Create `jest.config.js` in the project root:
  ```js
  module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: 30000
  };
  ```
- Optionally load environment variables in `tests/setup.js`:
  ```js
  require('dotenv').config({ path: '.env.test' });
  ```

### 3. Test Database
- Point `DATABASE_URL` to a dedicated schema (example in `.env.test`):
  ```
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/matchpoint_test"
  ```
- Run migrations:
  ```bash
  npx prisma migrate deploy
  ```
- In `tests/setup.js`, verify connectivity and handle cleanup:
  ```js
  const prisma = require('../src/lib/prisma');

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AuditLog","Registration","Standing","Match","TeamPlayer","Team","Player","Division","Court","Tournament" CASCADE'
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
  ```

### 4. Integration Tests
- Create `tests/tournaments.integration.test.js`:
  ```js
  const request = require('supertest');
  const app = require('../src/app');
  const prisma = require('../src/lib/prisma');

  describe('/api/v1/auth/login', () => {
    it('returns a token for valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: process.env.TD_EMAIL, password: process.env.TD_AUTH_PASSWORD });

      expect(response.statusCode).toBe(200);
      expect(response.body.token).toBeDefined();
    });
  });

  describe('/api/v1/tournaments', () => {
    let authHeader;

    const SAMPLE_IMPORT_CSV = `divisionName,divisionFormat,divisionLevel,divisionAgeGroup,teamName,player1First,player1Last,player1DOB,player2First,player2Last,player2DOB,seedNote
Men's Doubles,DOUBLE,INT,A18,Smash Bros,Mario,Bros,1985-01-01,Luigi,Bros,1987-02-02,Top seed
Mixed Doubles,DOUBLE,ADV,A18,Power Duo,Peach,Toadstool,1990-03-03,Mario,Bros,1985-01-01,
`;

    beforeEach(async () => {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: process.env.TD_EMAIL, password: process.env.TD_AUTH_PASSWORD });

      authHeader = { Authorization: `Bearer ${login.body.token}` };
    });

    test('creates a tournament and seeds courts', async () => {
      const response = await request(app)
        .post('/api/v1/tournaments')
        .set(authHeader)
        .send({ name: 'Test', slug: 'test', plannedCourtCount: 2 });

      expect(response.statusCode).toBe(201);
      expect(response.body.courts).toHaveLength(2);
    });

    test('rejects duplicate slug', async () => {
      await prisma.tournament.create({ data: { name: 'Existing', slug: 'dup' } });

      const response = await request(app)
        .post('/api/v1/tournaments')
        .set(authHeader)
        .send({ name: 'Duplicate', slug: 'dup' });

      expect(response.statusCode).toBe(409);
    });

    test('rejects invalid plannedCourtCount', async () => {
      const response = await request(app)
        .post('/api/v1/tournaments')
        .set(authHeader)
        .send({ name: 'Bad', slug: 'bad', plannedCourtCount: -1 });

      expect(response.statusCode).toBe(400);
      expect(response.body.errors).toContain(
        'plannedCourtCount must be a non-negative integer when provided'
      );
    });

    test('patch extends courts to planned count', async () => {
      await request(app)
        .post('/api/v1/tournaments')
        .set(authHeader)
        .send({ name: 'Grow', slug: 'grow', plannedCourtCount: 1 });

      const response = await request(app)
        .patch('/api/v1/tournaments/grow')
        .set(authHeader)
        .send({ name: 'Grow Updated', plannedCourtCount: 3 });

      expect(response.statusCode).toBe(200);
      expect(response.body.courts).toHaveLength(3);
    });

    test('imports consolidated CSV', async () => {
      await request(app)
        .post('/api/v1/tournaments')
        .set(authHeader)
        .send({ name: 'Import', slug: 'import' });

      const response = await request(app)
        .post('/api/v1/tournaments/import/import')
        .set(authHeader)
        .send({ csv: SAMPLE_IMPORT_CSV });

      expect(response.statusCode).toBe(201);
      expect(response.body.registrationsCreated).toBeGreaterThan(0);
    });
  });
  ```

### 5. Running the Suite
1. Ensure the Postgres test database is running and accessible with `DATABASE_URL`.
2. Apply migrations to the test database if schema changes occur.
3. Execute tests:
   ```bash
  npm test
   ```

### 6. Future Enhancements
- Add cases for date validation and slug updates
- Cover PATCH collisions (e.g. update slug → conflict)
- Integrate with CI to run on pull requests
