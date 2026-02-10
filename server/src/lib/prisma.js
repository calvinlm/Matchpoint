// src/lib/prisma.js
require('dotenv/config');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;

const adapter = new PrismaPg({
  connectionString: connectionString
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;