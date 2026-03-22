import { createApp } from './api/app.js';
import { env } from './config/env.js';
import { createRealtimeServer } from './ws/socketGateway.js';
import { logger } from './logger/index.js';
import { redis } from './redis/redisClient.js';
import { prisma } from './db/prisma.js';

const app = createApp();
const { httpServer } = createRealtimeServer(app);

async function bootstrap() {
  await redis.ping();
  await prisma.$connect();

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Multiplayer backend listening');
  });
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start multiplayer backend');
  process.exit(1);
});
