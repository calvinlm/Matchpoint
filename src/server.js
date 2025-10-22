const app = require('./app');
const prisma = require('./lib/prisma');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = app.listen(PORT, () => {
  console.log(`Match Point API listening on http://localhost:${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Closing server...`);
  server.close(async (closeError) => {
    if (closeError) {
      console.error('Error shutting down HTTP server', closeError);
      process.exit(1);
    }

    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error('Error disconnecting Prisma client', error);
    } finally {
      process.exit(0);
    }
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
