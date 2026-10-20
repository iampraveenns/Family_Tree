import { app } from './app.ts';
import { database } from './config/database.ts';
import { config } from './config/index.ts';
import { logger } from './utils/logger.ts';

async function startServer(): Promise<void> {
  // Connect to database (with graceful non-blocking fallback)
  await database.connect();

  const server = app.listen(config.PORT, '0.0.0.0', () => {
    logger.info(`FamilyRoots standalone backend running on http://0.0.0.0:${config.PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} signal received: closing HTTP server and database connections`);
    server.close(async () => {
      await database.disconnect();
      logger.info('HTTP server and database connections closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (process.argv[1]?.endsWith('server.ts')) {
  startServer().catch((err) => {
    logger.error({ err }, 'Failed to start standalone server');
    process.exit(1);
  });
}

export { startServer };
