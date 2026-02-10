// prisma/prisma.config.js
require('dotenv/config');
const { defineConfig, env } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seedUser.js',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});