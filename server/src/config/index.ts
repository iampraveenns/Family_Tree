import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.ts';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/familyroots'),
  JWT_SECRET: z.string().default('familyroots_jwt_development_secret_change_in_prod'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  STORAGE_PROVIDER: z.enum(['local', 's3', 'cloudinary']).default('local'),
  STORAGE_DIR: z.string().default('uploads'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  MAX_FILE_SIZE_BYTES: z.coerce.number().default(52428800), // 50MB default limit
  STORAGE_SIGNED_URL_EXPIRES_SECONDS: z.coerce.number().default(3600), // 1 hour access token
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    logger.warn({ issues: result.error.format() }, 'Invalid environment configuration; falling back to safe defaults');
    return envSchema.parse({});
  }

  const data = result.data;

  if (data.NODE_ENV === 'production' && data.JWT_SECRET === 'familyroots_jwt_development_secret_change_in_prod') {
    logger.warn(
      'SECURITY WARNING: JWT_SECRET is using the default development secret in production. Set a high-entropy secret in your environment.'
    );
  }

  return data;
};

export const config = parseEnv();
