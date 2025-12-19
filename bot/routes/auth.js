import { Router } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { authenticate, clearAuthCookie, setAuthCookie, signToken } from '../middleware/auth.js';
import { sanitizeUser } from '../utils/userUtils.js';

const router = Router();

async function ensureEnvUser(username) {
  const envUsername = process.env.ADMIN_USERNAME;
  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envUsername || !envPassword) return null;
  if (envUsername.toLowerCase().trim() !== username) return null;

  let user = await User.findOne({ username });
  if (user) return user;

  const passwordHash = await bcrypt.hash(envPassword, 10);
  user = new User({
    username,
    passwordHash,
    referralCode: username
  });
  await user.save();
  return user;
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  const normalized = String(username).toLowerCase().trim();

  let user = await User.findOne({ username: normalized });
  if (!user) {
    user = await ensureEnvUser(normalized);
  }
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const token = signToken(user);
  setAuthCookie(res, token);

  res.json({ token, user: sanitizeUser(user) });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.sanitizedUser });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;
