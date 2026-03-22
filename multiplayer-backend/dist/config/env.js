import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(8080),
    CORS_ORIGIN: z.string().default('*'),
    JWT_SECRET: z.string().min(12).default('test-secret-123456'),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/multiplayer?schema=public'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().default(120),
    MATCHMAKING_QUEUE_KEY: z.string().default('matchmaking:queue'),
    SOCKET_PING_TIMEOUT: z.coerce.number().default(20_000),
    SOCKET_PING_INTERVAL: z.coerce.number().default(10_000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});
export const env = envSchema.parse(process.env);
