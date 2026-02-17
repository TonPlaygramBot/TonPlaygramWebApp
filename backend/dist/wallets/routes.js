import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifySolanaSignature } from './verifySolana.js';
import { verifyEvmSignature } from './verifyEvm.js';
import { verifyTonProof } from './verifyTon.js';
function assertMessage(message, fields) {
    const lines = message.split('\n');
    const parsed = {};
    for (const line of lines) {
        const [k, ...rest] = line.split(':');
        parsed[k] = rest.join(':');
    }
    for (const [key, val] of Object.entries(fields)) {
        if (parsed[key] !== val)
            throw new Error(`Message ${key} mismatch`);
    }
}
async function verifyByChain(input) {
    if (input.chain === 'solana') {
        verifySolanaSignature({
            message: String(input.message ?? ''),
            signature: input.signature ?? [],
            address: input.address,
        });
        assertMessage(String(input.message ?? ''), {
            action: input.action,
            chain: input.chain,
            nonce: input.nonce,
            accountId: input.accountId,
            telegramUserId: input.telegramUserId,
        });
        return;
    }
    if (input.chain === 'evm') {
        verifyEvmSignature({
            message: String(input.message ?? ''),
            signature: String(input.signature ?? ''),
            address: input.address,
        });
        assertMessage(String(input.message ?? ''), {
            action: input.action,
            chain: input.chain,
            nonce: input.nonce,
            accountId: input.accountId,
            telegramUserId: input.telegramUserId,
        });
        return;
    }
    if (input.chain === 'ton') {
        verifyTonProof({ tonProof: input.tonProof, address: input.address, expectedPayload: input.nonce });
        return;
    }
    throw new Error('Unsupported chain');
}
export function walletsRouter(prisma, nonceStore) {
    const router = Router();
    const limiter = rateLimit({ windowMs: 60_000, max: 40 });
    router.use(limiter);
    router.get('/link/nonce', async (req, res) => {
        const session = req.session;
        const chain = req.query.chain;
        if (!['solana', 'evm', 'ton'].includes(chain))
            return res.status(400).json({ ok: false, error: 'Invalid chain' });
        const { nonce } = await nonceStore.createNonce({ purpose: 'link_wallet', accountId: session.accountId, chain, ttlMs: 5 * 60 * 1000 });
        const message = [
            'appName:TonPlaygram',
            'action:LINK_WALLET',
            `chain:${chain}`,
            `nonce:${nonce}`,
            `accountId:${session.accountId}`,
            `telegramUserId:${session.telegramUserId}`,
            `issuedAt:${new Date().toISOString()}`,
        ].join('\n');
        if (chain === 'ton')
            return res.json({ nonce, tonProofPayload: nonce });
        return res.json({ nonce, message });
    });
    router.get('/action/nonce', async (req, res) => {
        const session = req.session;
        const chain = req.query.chain;
        const purpose = req.query.purpose;
        if (!['solana', 'evm', 'ton'].includes(chain))
            return res.status(400).json({ ok: false, error: 'Invalid chain' });
        if (!['set_primary', 'unlink_wallet'].includes(purpose))
            return res.status(400).json({ ok: false, error: 'Invalid purpose' });
        const { nonce } = await nonceStore.createNonce({ purpose, accountId: session.accountId, chain, ttlMs: 5 * 60 * 1000 });
        const action = purpose === 'set_primary' ? 'SET_PRIMARY' : 'UNLINK_WALLET';
        const message = [
            'appName:TonPlaygram',
            `action:${action}`,
            `chain:${chain}`,
            `nonce:${nonce}`,
            `accountId:${session.accountId}`,
            `telegramUserId:${session.telegramUserId}`,
            `issuedAt:${new Date().toISOString()}`,
        ].join('\n');
        if (chain === 'ton')
            return res.json({ nonce, tonProofPayload: nonce });
        return res.json({ nonce, message });
    });
    router.post('/link/verify', async (req, res) => {
        try {
            const session = req.session;
            const { chain, address, provider, nonce, message, signature, tonProof } = req.body;
            await nonceStore.consumeNonce({ nonce, purpose: 'link_wallet', accountId: session.accountId, chain });
            await verifyByChain({ chain, address, nonce, accountId: session.accountId, telegramUserId: session.telegramUserId, action: 'LINK_WALLET', message, signature, tonProof });
            const existing = await prisma.linkedWallet.findUnique({ where: { chain_address: { chain, address } } });
            if (existing && existing.accountId !== session.accountId)
                return res.status(409).json({ ok: false, error: 'Wallet already linked to another account' });
            if (!existing) {
                const count = await prisma.linkedWallet.count({ where: { accountId: session.accountId } });
                await prisma.linkedWallet.create({ data: { accountId: session.accountId, chain, address, provider, isPrimary: count === 0 } });
            }
            const wallets = await prisma.linkedWallet.findMany({ where: { accountId: session.accountId } });
            return res.json({ ok: true, wallets });
        }
        catch (error) {
            return res.status(400).json({ ok: false, error: error.message });
        }
    });
    router.post('/set-primary', async (req, res) => {
        try {
            const session = req.session;
            const { walletId, nonce, message, signature, tonProof } = req.body;
            const wallet = await prisma.linkedWallet.findFirst({ where: { id: walletId, accountId: session.accountId } });
            if (!wallet)
                return res.status(404).json({ ok: false, error: 'Wallet not found' });
            await nonceStore.consumeNonce({ nonce, purpose: 'set_primary', accountId: session.accountId, chain: wallet.chain });
            await verifyByChain({ chain: wallet.chain, address: wallet.address, nonce, accountId: session.accountId, telegramUserId: session.telegramUserId, action: 'SET_PRIMARY', message, signature, tonProof });
            await prisma.$transaction([
                prisma.linkedWallet.updateMany({ where: { accountId: session.accountId }, data: { isPrimary: false } }),
                prisma.linkedWallet.update({ where: { id: walletId }, data: { isPrimary: true } }),
            ]);
            const wallets = await prisma.linkedWallet.findMany({ where: { accountId: session.accountId } });
            return res.json({ ok: true, wallets });
        }
        catch (error) {
            return res.status(400).json({ ok: false, error: error.message });
        }
    });
    router.post('/remove', async (req, res) => {
        try {
            const session = req.session;
            const { walletId, nonce, message, signature, tonProof } = req.body;
            const wallet = await prisma.linkedWallet.findFirst({ where: { id: walletId, accountId: session.accountId } });
            if (!wallet)
                return res.status(404).json({ ok: false, error: 'Wallet not found' });
            await nonceStore.consumeNonce({ nonce, purpose: 'unlink_wallet', accountId: session.accountId, chain: wallet.chain });
            await verifyByChain({ chain: wallet.chain, address: wallet.address, nonce, accountId: session.accountId, telegramUserId: session.telegramUserId, action: 'UNLINK_WALLET', message, signature, tonProof });
            await prisma.linkedWallet.delete({ where: { id: walletId } });
            const remaining = await prisma.linkedWallet.findMany({ where: { accountId: session.accountId }, orderBy: { verifiedAt: 'asc' } });
            if (wallet.isPrimary && remaining.length)
                await prisma.linkedWallet.update({ where: { id: remaining[0].id }, data: { isPrimary: true } });
            const wallets = await prisma.linkedWallet.findMany({ where: { accountId: session.accountId } });
            return res.json({ ok: true, wallets });
        }
        catch (error) {
            return res.status(400).json({ ok: false, error: error.message });
        }
    });
    return router;
}
