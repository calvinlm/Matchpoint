const request = require('supertest');
const Papa = require('papaparse');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');

const SAMPLE_IMPORT_CSV = `divisionName,divisionFormat,divisionLevel,divisionAgeGroup,teamName,player1First,player1Last,player1DOB,player2First,player2Last,player2DOB,seedNote
Men's Doubles,DOUBLE,INT,A18,Smash Bros,Mario,Bros,1985-01-01,Luigi,Bros,1987-02-02,Top seed
Men's Doubles,DOUBLE,INT,A18,Smash Bros,Mario,Bros,1985-01-01,Luigi,Bros,1987-02-02,
Mixed Doubles,DOUBLE,ADV,A18,Power Duo,Peach,Toadstool,1990-03-03,Mario,Bros,1985-01-01,
Mixed Doubles,DOUBLE,ADV,A18,,Peach,Toadstool,1990-03-03,Mario,Bros,1985-01-01,
Women's Doubles,DOUBLE,ADV,A35,Queens,Samus,Aran,1986-01-01,Zero,Suit,1986-01-01,New pairing
Women's Doubles,DOUBLE,ADV,A35,Queens,Samus,Aran,1986-01-01,Zero,Suit,invalid date,Duplicate row
Singles,RR,INT,A18,Rising Star,Link,Hyrule,1991-05-05,,,,
Singles,RR,INT,A18,Rising Star,Link,Hyrule,1991-05-05,,,,
Singles,RR,INT,A18,,Link,Hyrule,1991-05-05,,,,
`;

describe('/api/v1/auth/login', () => {
  test('returns token for valid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: process.env.TD_EMAIL, password: process.env.TD_AUTH_PASSWORD });

    expect(response.statusCode).toBe(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(10);
  });

  test('rejects invalid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: process.env.TD_EMAIL, password: 'wrong-password' });

    expect(response.statusCode).toBe(401);
  });
});

describe('/api/v1/tournaments', () => {
  let authHeader;

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
      .send({ name: 'Integration Test', slug: 'int-test', plannedCourtCount: 2 });

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Integration Test',
      slug: 'int-test',
      plannedCourtCount: 2,
    });
    expect(Array.isArray(response.body.courts)).toBe(true);
    expect(response.body.courts).toHaveLength(2);
    expect(response.body.courts.map((court) => court.label)).toEqual(['1', '2']);

    const auditEntries = await prisma.auditLog.findMany({
      where: { resourceId: response.body.id, action: 'TOURNAMENT_CREATE' },
    });
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].actor).toBe(process.env.TD_EMAIL);
  });

  test('rejects duplicate slug', async () => {
    await prisma.tournament.create({
      data: { name: 'Existing', slug: 'duplicate-slug' },
    });

    const response = await request(app)
      .post('/api/v1/tournaments')
      .set(authHeader)
      .send({ name: 'Duplicate', slug: 'duplicate-slug' });

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toMatch(/already exists/);
  });

  test('rejects invalid plannedCourtCount', async () => {
    const response = await request(app)
      .post('/api/v1/tournaments')
      .set(authHeader)
      .send({ name: 'Bad Courts', slug: 'bad-courts', plannedCourtCount: -1 });

    expect(response.statusCode).toBe(400);
    expect(response.body.errors).toContain(
      'plannedCourtCount must be a non-negative integer when provided'
    );
  });

  test('patch extends courts to planned count and logs audit entry', async () => {
    const created = await request(app)
      .post('/api/v1/tournaments')
      .set(authHeader)
      .send({ name: 'Grow', slug: 'grow', plannedCourtCount: 1 });

    const response = await request(app)
      .patch('/api/v1/tournaments/grow')
      .set(authHeader)
      .send({ name: 'Grow Updated', plannedCourtCount: 3 });

    expect(response.statusCode).toBe(200);
    expect(response.body.courts).toHaveLength(3);
    expect(response.body.courts.map((court) => court.label)).toEqual(['1', '2', '3']);

    const auditEntries = await prisma.auditLog.findMany({
      where: { resourceId: created.body.id, action: 'TOURNAMENT_UPDATE' },
    });
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].actor).toBe(process.env.TD_EMAIL);
  });

  test('patch updates slug when provided', async () => {
    await request(app)
      .post('/api/v1/tournaments')
      .set(authHeader)
      .send({ name: 'Slug Test', slug: 'slug-old' });

    const response = await request(app)
      .patch('/api/v1/tournaments/slug-old')
      .set(authHeader)
      .send({ name: 'Slug Test Updated', slug: 'slug-new' });

    expect(response.statusCode).toBe(200);
    expect(response.body.slug).toBe('slug-new');

    const followUp = await request(app).get('/api/v1/tournaments/slug-new');
    expect(followUp.statusCode).toBe(200);
    expect(followUp.body.name).toBe('Slug Test Updated');
  });

  test('imports consolidated CSV and assigns entry codes', async () => {
    await request(app)
      .post('/api/v1/tournaments')
      .set(authHeader)
      .send({ name: 'Import Test', slug: 'import-test' });

    const response = await request(app)
      .post('/api/v1/tournaments/import-test/import')
      .set(authHeader)
      .send({ csv: SAMPLE_IMPORT_CSV });

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({
      divisionsCreated: 4,
      playersCreated: 7,
      teamsCreated: 5,
      registrationsCreated: 5,
    });
    expect(Array.isArray(response.body.entryCodes)).toBe(true);

    const registrations = await prisma.registration.findMany({
      where: {
        division: {
          tournament: {
            slug: 'import-test',
          },
        },
      },
      include: {
        division: true,
      },
      orderBy: {
        entryCode: 'asc',
      },
    });

    expect(registrations).toHaveLength(5);

    const codesByDivision = registrations.reduce((acc, registration) => {
      const divisionName = registration.division.name;
      acc[divisionName] = acc[divisionName] || [];
      acc[divisionName].push(registration.entryCode);
      return acc;
    }, {});

    expect(codesByDivision).toMatchObject({
      "Men's Doubles": ['18MDInt_001'],
      'Mixed Doubles': ['18MDAdv_001'],
      "Women's Doubles": ['35WDAdv_001', '35WDAdv_002'],
      Singles: ['18SInt_001'],
    });

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: 'TOURNAMENT_IMPORT' },
    });
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].actor).toBe(process.env.TD_EMAIL);
  });

  test('requires authentication for import', async () => {
    await prisma.tournament.create({
      data: { name: 'Import Unauthorized', slug: 'import-unauth' },
    });

    const response = await request(app)
      .post('/api/v1/tournaments/import-unauth/import')
      .send({ csv: SAMPLE_IMPORT_CSV });

    expect(response.statusCode).toBe(401);
  });

  test('rejects import when CSV is missing', async () => {
    await request(app)
      .post('/api/v1/tournaments')
      .set(authHeader)
      .send({ name: 'Missing CSV', slug: 'missing-csv' });

    const response = await request(app)
      .post('/api/v1/tournaments/missing-csv/import')
      .set(authHeader)
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/csv string is required/);
  });

  test('rejects import when CSV has row-level errors', async () => {
    await request(app)
      .post('/api/v1/tournaments')
      .set(authHeader)
      .send({ name: 'Row Error CSV', slug: 'row-error' });

    const badCsv = `divisionName,divisionFormat,divisionLevel,divisionAgeGroup,teamName,player1First,player1Last,player1DOB,player2First,player2Last,player2DOB,seedNote
Men's Doubles,DOUBLE,INT,A18,Broken,,,,,,,
`;

    const response = await request(app)
      .post('/api/v1/tournaments/row-error/import')
      .set(authHeader)
      .send({ csv: badCsv });

    expect(response.statusCode).toBe(422);
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors[0].message).toMatch(/at least one player/);
  });

  test('increments entry code sequence across imports', async () => {
    await request(app)
      .post('/api/v1/tournaments')
      .set(authHeader)
      .send({ name: 'Sequential Import', slug: 'sequential-import' });

    await request(app)
      .post('/api/v1/tournaments/sequential-import/import')
      .set(authHeader)
      .send({ csv: SAMPLE_IMPORT_CSV });

    const secondCsv = `divisionName,divisionFormat,divisionLevel,divisionAgeGroup,teamName,player1First,player1Last,player1DOB,player2First,player2Last,player2DOB,seedNote
Men's Doubles,DOUBLE,INT,A18,New Smash,Toad,Bros,1992-01-01,Mario,Bros,1985-01-01,
`;

    const response = await request(app)
      .post('/api/v1/tournaments/sequential-import/import')
      .set(authHeader)
      .send({ csv: secondCsv });

    expect(response.statusCode).toBe(201);

    const registrations = await prisma.registration.findMany({
      where: {
        division: {
          tournament: {
            slug: 'sequential-import',
          },
          name: "Men's Doubles",
        },
      },
      select: {
        entryCode: true,
      },
      orderBy: {
        entryCode: 'asc',
      },
    });

    expect(registrations.map((r) => r.entryCode)).toEqual(['18MDInt_001', '18MDInt_002']);
  });

  test('exports consolidated CSV for a tournament', async () => {
    await request(app)
      .post('/api/v1/tournaments')
      .set(authHeader)
      .send({ name: 'Export Test', slug: 'export-test' });

    await request(app)
      .post('/api/v1/tournaments/export-test/import')
      .set(authHeader)
      .send({ csv: SAMPLE_IMPORT_CSV });

    const response = await request(app)
      .get('/api/v1/tournaments/export-test/export')
      .set(authHeader);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/csv/);

    const parsed = Papa.parse(response.text, { header: true, skipEmptyLines: true });

    expect(parsed.data).toHaveLength(5);

    const mensRow = parsed.data.find((row) => row.teamName === 'Smash Bros');
    expect(mensRow).toBeDefined();
    expect(mensRow.divisionName).toBe("Men's Doubles");
    expect(mensRow.player1First).toBe('Mario');
    expect(mensRow.player2First).toBe('Luigi');
    expect(mensRow.player1DOB).toBe('1985-01-01');
    expect(mensRow.player2DOB).toBe('1987-02-02');

    const womensRows = parsed.data.filter((row) => row.divisionName === "Women's Doubles");
    expect(womensRows).toHaveLength(2);
    womensRows.forEach((row) => {
      expect(row.divisionLevel).toBe('ADV');
    });
  });

  test('requires authentication for export', async () => {
    await prisma.tournament.create({
      data: { name: 'Export Unauthorized', slug: 'export-unauth' },
    });

    const response = await request(app).get('/api/v1/tournaments/export-unauth/export');

    expect(response.statusCode).toBe(401);
  });
});
