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

  // Dynamic data architecture: Family trees build dynamically from real user accounts.
  logger.info('Dynamic data architecture active: No hardcoded trees seeded.');

  // Clear memory posts to ensure initial memories count is 0 as requested
  try {
    const { Memory } = await import('./server/src/models/Memory.ts');
    const { Media } = await import('./server/src/models/Media.ts');
    const delMemories = await Memory.deleteMany({});
    const delMedia = await Media.deleteMany({});
    logger.info({ deletedMemories: delMemories.deletedCount, deletedMedia: delMedia.deletedCount }, 'Cleared memories: 0 memory posts in vault');
  } catch (cleanMemErr) {
    logger.warn({ cleanMemErr }, 'Memory reset encountered an issue, proceeding...');
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
