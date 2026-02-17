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

const prisma = new PrismaClient();
const nonceStore = new NonceStore(prisma);
const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.post('/api/auth/telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    const parsed = verifyTelegramInitData(initData, env.botToken);

    const account = await prisma.account.upsert({
      where: { telegramUserId: parsed.telegramUserId },
      create: {
        telegramUserId: parsed.telegramUserId,
        telegramUsername: parsed.telegramUsername,
      },
      update: {
        telegramUsername: parsed.telegramUsername,
      },
    });

    const token = signSession({
      accountId: account.id,
      telegramUserId: account.telegramUserId,
    });
    setSessionCookie(res, token);

    const wallets = await prisma.linkedWallet.findMany({ where: { accountId: account.id } });
    return res.json({ ok: true, account, wallets });
  } catch (error) {
    return res.status(401).json({ ok: false, error: (error as Error).message });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  const session = (req as any).session as { accountId: string; telegramUserId: string };
  const account = await prisma.account.findUnique({ where: { id: session.accountId } });
  if (!account) return res.status(404).json({ ok: false, error: 'Account not found' });
  const wallets = await prisma.linkedWallet.findMany({ where: { accountId: session.accountId } });
  return res.json({ ok: true, account, wallets });
});

app.post('/api/logout', (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.use('/api/wallets', requireAuth, walletsRouter(prisma, nonceStore));

app.listen(env.port, () => {
  console.log(`Server listening at http://localhost:${env.port}`);
});
