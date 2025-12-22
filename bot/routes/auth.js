import { Router } from 'express';
import User from '../models/User.js';
import { generateWalletAddress } from '../utils/wallet.js';
import { createState, consumeState } from '../utils/authState.js';
import { issueTokens, verifyRefreshToken, revokeRefreshToken, parseCookies } from '../utils/authTokens.js';
import { verifyTelegramLogin } from '../utils/telegramAuth.js';
import { exchangeGoogleCode, verifyGoogleIdToken } from '../utils/googleAuth.js';
import { createNonce, verifyWalletSignature } from '../utils/walletAuth.js';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize.js';

const router = Router();

function standardResponse(res, user, tokens, redirectUri) {
  const { accessToken, refreshToken, refreshExpiresAt } = tokens;
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(refreshExpiresAt)
  });
  res.json({
    user: {
      accountId: user.accountId,
      telegramId: user.telegramId,
      googleId: user.googleId,
      walletAddress: user.walletAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      photo: user.photo,
      nickname: user.nickname
    },
    accessToken,
    refreshToken,
    redirectUri
  });
}

router.post('/state', (req, res) => {
  const { provider, redirectUri } = req.body || {};
  if (!provider) return res.status(400).json({ error: 'provider required' });
  const state = createState(provider, redirectUri || '');
  res.json(state);
});

router.post('/wallet/nonce', (req, res) => {
  const { address } = req.body || {};
  const { nonce, expiresAt } = createNonce(address);
  res.json({ nonce, expiresAt });
});

router.post('/:provider', async (req, res) => {
  const { provider } = req.params;
  const { state } = req.body || {};
  const entry = consumeState(state, provider);
  if (!entry) return res.status(400).json({ error: 'invalid state' });

  try {
    if (provider === 'telegram') {
      const profile = verifyTelegramLogin(req.body || {});
      if (!profile) return res.status(401).json({ error: 'invalid telegram data' });
      const user = await upsertUserFromTelegram(profile);
      const tokens = issueTokens(user);
      return standardResponse(res, user, tokens, entry.redirectUri);
    }

    if (provider === 'google') {
      const { code, idToken, redirectUri } = req.body || {};
      let payload = null;
      if (code) {
        try {
          const { id_token: tokenFromCode } = await exchangeGoogleCode(code, redirectUri || entry.redirectUri);
          payload = await verifyGoogleIdToken(tokenFromCode);
        } catch (err) {
          console.error('Failed to exchange Google code');
        }
      } else if (idToken) {
        payload = await verifyGoogleIdToken(idToken);
      }
      if (!payload) return res.status(401).json({ error: 'invalid google token' });
      const user = await upsertUserFromGoogle(payload);
      const tokens = issueTokens(user);
      return standardResponse(res, user, tokens, entry.redirectUri);
    }

    if (provider === 'wallet') {
      const { signature, address, nonce } = req.body || {};
      const signer = verifyWalletSignature({ address, signature, nonce, appName: process.env.APP_NAME });
      if (!signer) return res.status(401).json({ error: 'invalid wallet signature' });
      const user = await upsertUserFromWallet(signer);
      const tokens = issueTokens(user);
      return standardResponse(res, user, tokens, entry.redirectUri);
    }

    return res.status(400).json({ error: 'unknown provider' });
  } catch (err) {
    console.error('Auth error', err.message);
    res.status(500).json({ error: 'auth failed' });
  }
});

router.post('/refresh', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.refreshToken || req.body?.refreshToken;
  const entry = verifyRefreshToken(token);
  if (!entry) return res.status(401).json({ error: 'invalid refresh token' });
  const user = await User.findOne({ accountId: entry.userId });
  if (!user) return res.status(401).json({ error: 'unknown user' });
  const tokens = issueTokens(user);
  standardResponse(res, user, tokens, null);
});

router.post('/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.refreshToken || req.body?.refreshToken;
  if (token) revokeRefreshToken(token);
  res.cookie('refreshToken', '', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0 });
  res.json({ success: true });
});

async function upsertUserFromTelegram(profile) {
  let user = await User.findOne({ telegramId: profile.id });
  if (!user) {
    const wallet = await generateWalletAddress();
    user = new User({
      telegramId: profile.id,
      accountId: profile.id.toString(),
      referralCode: profile.id.toString(),
      walletAddress: wallet.address,
      walletPublicKey: wallet.publicKey
    });
  }
  user.firstName = profile.firstName || user.firstName;
  user.lastName = profile.lastName || user.lastName;
  user.nickname = profile.username || user.nickname;
  user.photo = profile.photoUrl || user.photo;
  await user.save();
  return user;
}

async function upsertUserFromGoogle(payload) {
  let user = await User.findOne({ googleId: payload.googleId });
  if (!user) {
    const wallet = await generateWalletAddress();
    user = new User({
      googleId: payload.googleId,
      googleEmail: payload.email,
      accountId: payload.googleId,
      referralCode: payload.googleId,
      walletAddress: wallet.address,
      walletPublicKey: wallet.publicKey
    });
  }
  const [firstName = '', lastName = ''] = sanitizeText(payload.name || '').split(' ');
  user.firstName = firstName || user.firstName;
  user.lastName = lastName || user.lastName;
  user.photo = sanitizeUrl(payload.picture) || user.photo;
  user.googleEmail = payload.email || user.googleEmail;
  await user.save();
  return user;
}

async function upsertUserFromWallet(address) {
  let user = await User.findOne({ walletAddress: address });
  if (!user) {
    user = new User({
      walletAddress: address,
      walletPublicKey: '',
      accountId: address,
      referralCode: address
    });
  }
  await user.save();
  return user;
}

export default router;
