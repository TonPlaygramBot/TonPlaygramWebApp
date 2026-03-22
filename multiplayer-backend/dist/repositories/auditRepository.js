import { prisma } from '../db/prisma.js';
export async function logConnectionEvent(params) {
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
