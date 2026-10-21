require('dotenv/config');
const bcrypt = require('bcryptjs');

// Loaded only after the credentials pass validation, so a misconfigured run never touches the database.
let prisma = null;

const ROLES = ['ADMIN', 'TOURNAMENT_DIRECTOR', 'REFERREE'];
const MIN_PASSWORD_LENGTH = 12;

function readCredentials() {
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim();
  const password = process.env.SEED_ADMIN_PASSWORD || '';
  const role = (process.env.SEED_ADMIN_ROLE || 'ADMIN').trim();

  const problems = [];
  if (!email) {
    problems.push('SEED_ADMIN_EMAIL is not set');
  }
  if (!password) {
    problems.push('SEED_ADMIN_PASSWORD is not set');
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!ROLES.includes(role)) {
    problems.push(`SEED_ADMIN_ROLE must be one of ${ROLES.join(', ')}`);
  }

  if (problems.length > 0) {
    const error = new Error(
      [
        'Seed stopped: there are no default admin credentials.',
        ...problems.map((problem) => `  - ${problem}`),
        'Set them in server/.env or on the command line, for example:',
        '  SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD="<12+ characters>" npm run prisma:seed',
      ].join('\n'),
    );
    error.isConfigError = true;
    throw error;
  }

  return { email, password, role };
}

async function main() {
  const { email, password, role } = readCredentials();
  prisma = require('../src/lib/prisma');
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { password: passwordHash, role },
    create: { email, password: passwordHash, role },
  });

  console.log(`Seeded admin user ${email} with role ${role}`);
}

main()
  .catch((err) => {
    if (err.isConfigError) {
      console.error(err.message);
    } else {
      console.error('Seed failed', err);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
