import { prisma } from '../db/prisma.js';
export async function upsertUser(userId, username) {
    return prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, username, externalId: userId },
        update: { username },
    });
}
