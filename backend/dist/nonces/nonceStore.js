import { randomBytes } from 'crypto';
export class NonceStore {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createNonce(input) {
        const nonce = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + input.ttlMs);
        await this.prisma.nonce.create({
            data: {
                nonce,
                purpose: input.purpose,
                accountId: input.accountId,
                chain: input.chain,
                expiresAt,
            },
        });
        return { nonce, expiresAt };
    }
    async consumeNonce(input) {
        const record = await this.prisma.nonce.findUnique({ where: { nonce: input.nonce } });
        if (!record)
            throw new Error('Nonce not found');
        if (record.purpose !== input.purpose)
            throw new Error('Nonce purpose mismatch');
        if (record.accountId !== input.accountId)
            throw new Error('Nonce account mismatch');
        if (record.chain !== input.chain)
            throw new Error('Nonce chain mismatch');
        if (record.usedAt)
            throw new Error('Nonce already used');
        if (record.expiresAt.getTime() < Date.now())
            throw new Error('Nonce expired');
        const consumed = await this.prisma.nonce.updateMany({
            where: { nonce: input.nonce, usedAt: null },
            data: { usedAt: new Date() },
        });
        if (consumed.count !== 1)
            throw new Error('Nonce already consumed');
        return record;
    }
}
