export const PAID_PLAY_PAUSE_CODE = 'paid_play_temporarily_paused';
export const PAID_PLAY_PAUSE_MESSAGE = 'Paid Snake and Pool play, rewards and training-attempt purchases are paused while settlement is upgraded. Free practice remains available; no TPG rewards are credited.';
const affected = new Set(['snake', 'snakeandladder', 'pool', 'poolroyale', 'poolroyaleonline']);
const canonical = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function isPausedPaidGame(game, stake) {
  const amount = stake && typeof stake === 'object' && !Array.isArray(stake) ? stake.amount : stake;
  return affected.has(canonical(game)) && amount !== 0 && amount !== '0';
}
export function isPausedGameDebit(body = {}) {
  return Number(body.amount) < 0 && affected.has(canonical(body.game));
}
export function isPausedTrainingPurchase(body = {}) {
  return Array.isArray(body.bundle?.items) && body.bundle.items.some((item) =>
    canonical(item?.type) === 'pooltrainingattempt');
}
export function rejectPausedPaidAction(req, res, next) {
  if (!isPausedGameDebit(req.body) && !isPausedTrainingPurchase(req.body)) return next();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).json({ error: PAID_PLAY_PAUSE_MESSAGE, code: PAID_PLAY_PAUSE_CODE });
}
