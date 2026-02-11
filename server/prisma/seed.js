require('dotenv/config');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const role = process.env.SEED_ADMIN_ROLE || 'ADMIN';

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
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });