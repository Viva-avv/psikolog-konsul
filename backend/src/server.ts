import http from 'http';
import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { startHoldExpiryJob } from './jobs/expireHolds';
import { initSockets } from './sockets';

const server = http.createServer(createApp());
initSockets(server);

server.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
  startHoldExpiryJob();
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
