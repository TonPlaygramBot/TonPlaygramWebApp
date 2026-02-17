import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

export type Chain = 'solana' | 'evm' | 'ton';
export type NoncePurpose = 'login' | 'link_wallet' | 'unlink_wallet' | 'set_primary';

export class NonceStore {
  constructor(private prisma: PrismaClient) {}

  async createNonce(input: {
    purpose: NoncePurpose;
    accountId?: string;
    chain?: Chain;
    ttlMs: number;
  }) {
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

  async consumeNonce(input: {
    nonce: string;
    purpose: NoncePurpose;
    accountId?: string;
    chain?: Chain;
  }) {
    const record = await this.prisma.nonce.findUnique({ where: { nonce: input.nonce } });
    if (!record) throw new Error('Nonce not found');
    if (record.purpose !== input.purpose) throw new Error('Nonce purpose mismatch');
    if (input.accountId && record.accountId !== input.accountId) throw new Error('Nonce account mismatch');
    if (input.chain && record.chain !== input.chain) throw new Error('Nonce chain mismatch');
    if (record.usedAt) throw new Error('Nonce already used');
    if (record.expiresAt.getTime() < Date.now()) throw new Error('Nonce expired');

    const consumed = await this.prisma.nonce.updateMany({
      where: { nonce: input.nonce, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw new Error('Nonce already consumed');
    return record;
  }
}
