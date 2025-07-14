import { useEffect } from 'react';
import { getTelegramId } from '../utils/telegram.js';
import { claimReferral } from '../utils/api.js';

export default function useReferralClaim() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const param =
      window?.Telegram?.WebApp?.initDataUnsafe?.start_param || urlParams.get('ref');
    if (!param) return;
    const telegramId = getTelegramId();
    if (!telegramId) return;
    const key = `referral_claimed_${param}`;
    if (localStorage.getItem(key)) return;
    claimReferral(telegramId, param)
      .then(() => localStorage.setItem(key, '1'))
      .catch(() => {});
  }, []);
}
