import crypto from 'crypto';
export function verifyTelegramInitData(initData, botToken) {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const authDateRaw = params.get('auth_date');
    const userRaw = params.get('user');
    if (!hash || !authDateRaw || !userRaw) {
        throw new Error('Invalid initData: missing required fields');
    }
    const authDate = Number(authDateRaw);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(authDate) || now - authDate > 86400) {
        throw new Error('Telegram auth_date is stale');
    }
    const pairs = [];
    params.forEach((value, key) => {
        if (key !== 'hash')
            pairs.push(`${key}=${value}`);
    });
    pairs.sort();
    const dataCheckString = pairs.join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    if (computedHash !== hash) {
        throw new Error('Invalid Telegram initData signature');
    }
    const user = JSON.parse(userRaw);
    return {
        telegramUserId: String(user.id),
        telegramUsername: user.username,
    };
}
