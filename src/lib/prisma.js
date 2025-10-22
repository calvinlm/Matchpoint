const { PrismaClient } = require('@prisma/client');

/**
 * Singleton Prisma client for the API layer.
 * Keeps a single connection pool across route handlers.
 */
const prisma = new PrismaClient();

module.exports = prisma;
