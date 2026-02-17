import { readSession } from '../auth/session.js';
export function requireAuth(req, res, next) {
    const session = readSession(req);
    if (!session) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    req.session = {
        accountId: session.accountId,
        telegramUserId: session.telegramUserId,
    };
    next();
}
