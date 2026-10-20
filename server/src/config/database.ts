import mongoose from 'mongoose';
import { config } from './index.ts';
import { logger } from '../utils/logger.ts';

interface DatabaseStatus {
  isConnected: boolean;
  readyState: number;
  host?: string;
  name?: string;
}

class Database {
  private static instance: Database;
  private isConnecting = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private memoryServer: any = null;

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private setupListeners(): void {
    mongoose.connection.on('connected', () => {
      logger.info({ host: mongoose.connection.host, db: mongoose.connection.name }, 'MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.warn({ err: err.message }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.info('MongoDB disconnected');
    });
  }

  public async connect(): Promise<boolean> {
    if (mongoose.connection.readyState === 1) {
      return true;
    }

    if (this.isConnecting) {
      return false;
    }

    this.isConnecting = true;

    // First attempt connecting to configured URI
    try {
      const sanitizedUri = config.MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@');
      logger.info({ uri: sanitizedUri }, 'Connecting to MongoDB...');
      await mongoose.connect(config.MONGODB_URI, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 3000,
      });
      this.isConnecting = false;
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      logger.warn(
        { error: message },
        'External MongoDB daemon unavailable. Bootstrapping embedded MongoDB Memory Server for real MongoDB queries...'
      );

      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        this.memoryServer = await MongoMemoryServer.create({
          instance: {
            dbName: 'familyroots',
          },
        });
        const memoryUri = this.memoryServer.getUri();
        logger.info({ uri: memoryUri }, 'Embedded MongoDB Memory Server active. Connecting Mongoose...');
        await mongoose.connect(memoryUri);
        this.isConnecting = false;
        return true;
      } catch (memErr: unknown) {
        this.isConnecting = false;
        const memMsg = memErr instanceof Error ? memErr.message : 'Memory server error';
        logger.error({ error: memMsg }, 'Failed to initialize MongoDB Memory Server');
        return false;
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('MongoDB connection closed');
    }
    if (this.memoryServer) {
      await this.memoryServer.stop();
      this.memoryServer = null;
      logger.info('Embedded MongoDB Memory Server stopped');
    }
  }

  public getStatus(): DatabaseStatus {
    return {
      isConnected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host || undefined,
      name: mongoose.connection.name || undefined,
    };
  }
}

export const database = Database.getInstance();
