import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { verifyTelegramInitData } from './auth/telegramVerify.js';
import { clearSessionCookie, setSessionCookie, signSession } from './auth/session.js';
import { requireAuth } from './middleware/auth.js';
import { NonceStore } from './nonces/nonceStore.js';
import { walletsRouter } from './wallets/routes.js';
import { verifyGoogleIdToken } from './auth/googleVerify.js';
import { verifyEvmSignature } from './wallets/verifyEvm.js';
import { verifySolanaSignature } from './wallets/verifySolana.js';
import { verifyTonProof } from './wallets/verifyTon.js';
import type { Chain } from './nonces/nonceStore.js';
import { fetchTopMarkets, getConversionQuote } from './exchange/markets.js';

const prisma = new PrismaClient();
const nonceStore = new NonceStore(prisma);
const app = express();

app.use(cors({ origin: env.frontendOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.post('/api/auth/telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    if (!env.botToken) return res.status(400).json({ ok: false, error: 'BOT_TOKEN is not configured' });
    const parsed = verifyTelegramInitData(initData, env.botToken);

    const account = await prisma.account.upsert({
      where: { telegramUserId: parsed.telegramUserId },
      create: { telegramUserId: parsed.telegramUserId, telegramUsername: parsed.telegramUsername, primaryAuthMethod: 'telegram' },
      update: { telegramUsername: parsed.telegramUsername },
    });

    setSessionCookie(res, signSession({ accountId: account.id, telegramUserId: account.telegramUserId ?? undefined, googleSub: account.googleSub ?? undefined }));
    const wallets = await prisma.linkedWallet.findMany({ where: { accountId: account.id } });
    return res.json({ ok: true, account, wallets });
  } catch (error) {
    return res.status(401).json({ ok: false, error: (error as Error).message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body as { idToken: string };
    const profile = await verifyGoogleIdToken(idToken);
    const account = await prisma.account.upsert({
      where: { googleSub: profile.sub },
      create: { googleSub: profile.sub, googleEmail: profile.email, primaryAuthMethod: 'google' },
      update: { googleEmail: profile.email },
    });

    setSessionCookie(res, signSession({ accountId: account.id, telegramUserId: account.telegramUserId ?? undefined, googleSub: account.googleSub ?? undefined }));
    const wallets = await prisma.linkedWallet.findMany({ where: { accountId: account.id } });
    return res.json({ ok: true, account, wallets });
  } catch (error) {
    return res.status(401).json({ ok: false, error: (error as Error).message });
  }
});

app.get('/api/auth/wallet/nonce', async (req, res) => {
  const chain = req.query.chain as Chain;
  if (!['solana', 'evm', 'ton'].includes(chain)) return res.status(400).json({ ok: false, error: 'Invalid chain' });
  const { nonce } = await nonceStore.createNonce({ purpose: 'login', chain, ttlMs: 5 * 60 * 1000 });
  const message = [
    'appName:TonPlaygram',
    'action:LOGIN',
    `chain:${chain}`,
    `nonce:${nonce}`,
    'accountId:new',
    'subject:wallet-login',
    `issuedAt:${new Date().toISOString()}`,
  ].join('\n');
  return chain === 'ton' ? res.json({ nonce, tonProofPayload: nonce }) : res.json({ nonce, message });
});

app.post('/api/auth/wallet/verify', async (req, res) => {
  try {
    const { chain, address, provider, nonce, message, signature, tonProof } = req.body as any;
    await nonceStore.consumeNonce({ nonce, purpose: 'login', chain });

    if (chain === 'solana') verifySolanaSignature({ message, signature, address });
    else if (chain === 'evm') verifyEvmSignature({ message, signature, address });
    else if (chain === 'ton') verifyTonProof({ tonProof, address, expectedPayload: nonce });
    else return res.status(400).json({ ok: false, error: 'Unsupported chain' });

    let wallet = await prisma.linkedWallet.findUnique({ where: { chain_address: { chain, address } } });
    let account;
    if (!wallet) {
      account = await prisma.account.create({ data: { primaryAuthMethod: 'wallet' } });
      wallet = await prisma.linkedWallet.create({ data: { accountId: account.id, chain, address, provider, isPrimary: true } });
    } else {
      account = await prisma.account.findUniqueOrThrow({ where: { id: wallet.accountId } });
    }

    setSessionCookie(res, signSession({ accountId: account.id, telegramUserId: account.telegramUserId ?? undefined, googleSub: account.googleSub ?? undefined }));
    const wallets = await prisma.linkedWallet.findMany({ where: { accountId: account.id } });
    return res.json({ ok: true, account, wallets });
  } catch (error) {
    return res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

app.post('/api/auth/sync/google', requireAuth, async (req, res) => {
  try {
    const session = (req as any).session as { accountId: string };
    const { idToken } = req.body as { idToken: string };
    const profile = await verifyGoogleIdToken(idToken);

    const already = await prisma.account.findUnique({ where: { googleSub: profile.sub } });
    if (already && already.id !== session.accountId) return res.status(409).json({ ok: false, error: 'Google account already linked to another TPC account' });

    const account = await prisma.account.update({ where: { id: session.accountId }, data: { googleSub: profile.sub, googleEmail: profile.email } });
    return res.json({ ok: true, account });
  } catch (error) {
    return res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

app.post('/api/auth/sync/telegram', requireAuth, async (req, res) => {
  try {
    if (!env.botToken) return res.status(400).json({ ok: false, error: 'BOT_TOKEN is not configured' });
    const session = (req as any).session as { accountId: string };
    const { initData } = req.body as { initData: string };
    const tg = verifyTelegramInitData(initData, env.botToken);

    const already = await prisma.account.findUnique({ where: { telegramUserId: tg.telegramUserId } });
    if (already && already.id !== session.accountId) return res.status(409).json({ ok: false, error: 'Telegram account already linked to another TPC account' });

    const account = await prisma.account.update({ where: { id: session.accountId }, data: { telegramUserId: tg.telegramUserId, telegramUsername: tg.telegramUsername } });
    return res.json({ ok: true, account });
  } catch (error) {
    return res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  const session = (req as any).session as { accountId: string };
  const account = await prisma.account.findUnique({ where: { id: session.accountId } });
  if (!account) return res.status(404).json({ ok: false, error: 'Account not found' });
  const wallets = await prisma.linkedWallet.findMany({ where: { accountId: session.accountId } });
  return res.json({ ok: true, account, wallets });
});

app.get('/api/exchange/markets', async (_req, res) => {
  try {
    const markets = await fetchTopMarkets();
    return res.json({ ok: true, markets });
  } catch (error) {
    return res.status(502).json({ ok: false, error: (error as Error).message });
  }
});

app.post('/api/exchange/quote', async (req, res) => {
  try {
    const { fromSymbol, amount } = req.body as { fromSymbol: string; amount: number };
    const quote = await getConversionQuote(fromSymbol, amount, env.tpcUsdPrice);
    return res.json({ ok: true, quote });
  } catch (error) {
    return res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

app.post('/api/logout', (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.use('/api/wallets', requireAuth, walletsRouter(prisma, nonceStore));
app.listen(env.port, () => console.log(`Server listening at http://localhost:${env.port}`));
