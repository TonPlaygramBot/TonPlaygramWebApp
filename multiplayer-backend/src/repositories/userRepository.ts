import { prisma } from '../db/prisma.js';

export async function upsertUser(userId: string, username: string) {
  return prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, username, externalId: userId },
    update: { username },
  });
}
