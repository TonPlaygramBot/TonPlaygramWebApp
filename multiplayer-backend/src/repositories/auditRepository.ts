import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export async function logConnectionEvent(params: {
  userId: string;
  socketId: string;
  event: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.JsonObject;
}) {
  return prisma.connectionAuditLog.create({
    data: {
      userId: params.userId,
      socketId: params.socketId,
      event: params.event,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: params.metadata,
    },
  });
}
