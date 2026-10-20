import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/src/app.ts';
import { database } from './server/src/config/database.ts';
import { logger } from './server/src/utils/logger.ts';

const PORT = 3000;

async function bootstrap() {
  const app = createApp();

  // Attempt database connection
  await database.connect();

  // Ensure default seed data exists in database
  try {
    const { Family } = await import('./server/src/models/Family.ts');
    const familyCount = await Family.countDocuments();
    if (familyCount === 0) {
      logger.info('No family vaults detected in database. Seeding initial Pattara Family heritage vault...');
      const { runSeed } = await import('./server/src/scripts/seed.ts');
      await runSeed();
    }
  } catch (seedErr) {
    logger.warn({ seedErr }, 'Initial database seed check encountered an issue, proceeding...');
  }

  // Run memory type migration for legacy or removed categories
  try {
    const { runMemoryTypeMigration } = await import('./server/src/scripts/migrateMemoryTypes.ts');
    await runMemoryTypeMigration();
  } catch (migErr) {
    logger.warn({ migErr }, 'Memory type migration encountered an issue, proceeding...');
  }

  // In development, hook Vite middleware for SPA serving and hot compilation
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    logger.info('Vite development middleware mounted');
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    logger.info({ distPath }, 'Serving production build from dist');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`FamilyRoots unified application running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} signal received: gracefully terminating server`);
    server.close(async () => {
      await database.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start FamilyRoots application server');
  process.exit(1);
});
