const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient({});

async function main() {
  const hash = await bcrypt.hash("Matchpoint2025", 12);

  await prisma.user.create({
    data: {
      email: "admin@matchpoint.local",
      password: hash,
      role: "ADMIN",
    },
  });

  console.log("✅ Admin user seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
