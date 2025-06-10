import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

const codes = new Map(); // telegramId -> code
const referrals = new Map(); // code -> array of telegramIds

router.post('/code', (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  let code = codes.get(telegramId);
  if (!code) {
    code = crypto.randomBytes(4).toString('hex');
    codes.set(telegramId, code);
    referrals.set(code, []);
  }
  res.json({ code, referrals: referrals.get(code).length });
});

router.post('/claim', (req, res) => {
  const { telegramId, code } = req.body;
  if (!telegramId || !code) {
    return res.status(400).json({ error: 'telegramId and code required' });
  }
  const users = referrals.get(code);
  if (!users) return res.status(400).json({ error: 'invalid code' });
  if (users.includes(telegramId)) {
    return res.json({ message: 'already claimed' });
  }
  users.push(telegramId);
  res.json({ message: 'claimed', total: users.length });
});

export default router;
