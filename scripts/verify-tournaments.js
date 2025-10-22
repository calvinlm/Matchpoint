const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');

async function run() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Skipping tournament API smoke test.');
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    throw new Error(
      `Unable to connect to database defined by DATABASE_URL (${process.env.DATABASE_URL}).\n` +
        `Start the Postgres instance and rerun the script.\n${error}`
    );
  }

  const loginPassword = process.env.TD_AUTH_PASSWORD;
  if (!loginPassword) {
    console.warn('TD_AUTH_PASSWORD is not set. Skipping tournament API smoke test that requires auth.');
    return;
  }

  const slug = `api-test-${Date.now()}`;
  const agent = request(app);

  try {
    const loginResponse = await agent.post('/api/v1/auth/login').send({
      email: process.env.TD_EMAIL,
      password: loginPassword,
    });

    if (loginResponse.statusCode !== 200) {
      throw new Error(
        `Login failed before tests could run. Status ${loginResponse.statusCode}: ${JSON.stringify(
          loginResponse.body
        )}`
      );
    }

    const { token } = loginResponse.body;
    const authHeader = { Authorization: `Bearer ${token}` };

    // Create tournament
    const createResponse = await agent.post('/api/v1/tournaments').send({
      name: 'API Test Tournament',
      slug,
      plannedCourtCount: 3,
      location: 'Test Location',
      startDate: '2025-10-20T08:00:00.000Z',
    }).set(authHeader);

    if (createResponse.statusCode !== 201) {
      throw new Error(
        `Expected POST status 201, received ${createResponse.statusCode}: ${JSON.stringify(createResponse.body)}`
      );
    }

    if (!Array.isArray(createResponse.body.courts) || createResponse.body.courts.length !== 3) {
      throw new Error('POST did not create expected number of courts (3)');
    }

    // Fetch
    const getResponse = await agent.get(`/api/v1/tournaments/${slug}`);
    if (getResponse.statusCode !== 200) {
      throw new Error(
        `Expected GET status 200, received ${getResponse.statusCode}: ${JSON.stringify(getResponse.body)}`
      );
    }

    if (!Array.isArray(getResponse.body.courts) || getResponse.body.courts.length !== 3) {
      throw new Error('GET did not return expected number of courts (3)');
    }

    // Update planned courts -> 4
    const patchResponse = await agent
      .patch(`/api/v1/tournaments/${slug}`)
      .send({
        name: 'API Test Tournament Updated',
        plannedCourtCount: 4,
      })
      .set(authHeader);

    if (patchResponse.statusCode !== 200) {
      throw new Error(
        `Expected PATCH status 200, received ${patchResponse.statusCode}: ${JSON.stringify(patchResponse.body)}`
      );
    }

    if (!Array.isArray(patchResponse.body.courts) || patchResponse.body.courts.length !== 4) {
      throw new Error('PATCH did not upsert expected number of courts (4)');
    }

    console.log('Tournament API smoke test complete ✅');
  } finally {
    // Clean up created tournament (if it exists)
    await prisma.tournament
      .delete({
        where: { slug },
      })
      .catch(() => {});

    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
