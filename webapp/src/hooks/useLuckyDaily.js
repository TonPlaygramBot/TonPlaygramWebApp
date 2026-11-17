import { useEffect, useRef, useState } from 'react';
import { claimLuckyDaily } from '../utils/luckyDaily.js';
import { getTelegramId } from '../utils/telegram.js';

// UI response routing only. These hints never authorize the server claim.
function currentIdentity() {
  let telegramId = null;
  try { telegramId = getTelegramId(); } catch { /* Not signed in. */ }
  return JSON.stringify([
    localStorage.getItem('accountId'),
    localStorage.getItem('googleId'),
    telegramId
  ]);
}

export default function useLuckyDaily(accountKey) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ busy: true, error: '', receipt: null });
  const busy = useRef(true);
  const generation = useRef(0);
  const identity = currentIdentity();

  useEffect(() => {
    const changed = (event) => {
      if (event.type === 'storage' && !['accountId', 'googleId', 'telegramId', null].includes(event.key)) return;
      // Invalidate synchronously, before React can render the new account.
      generation.current += 1;
      busy.current = true;
      setAttempt((value) => value + 1);
    };
    const events = ['social-auth-changed', 'accountUpdated', 'telegramAuthUpdated', 'googleProfileUpdated', 'storage'];
    events.forEach((event) => window.addEventListener(event, changed));
    return () => events.forEach((event) => window.removeEventListener(event, changed));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestIdentity = currentIdentity();
    const requestGeneration = generation.current;
    const isCurrent = () => !cancelled && requestGeneration === generation.current && requestIdentity === currentIdentity();
    busy.current = true;
    setState({ busy: true, error: '', receipt: null });
    claimLuckyDaily().then((receipt) => {
      if (!isCurrent()) return;
      busy.current = false;
      setState({ busy: false, error: '', receipt });
      window.dispatchEvent(new CustomEvent('walletBalanceUpdated', {
        detail: { balance: receipt.balance }
      }));
    }).catch((error) => {
      if (!isCurrent()) return;
      busy.current = false;
      setState({ busy: false, error: error?.message || 'Daily reward could not be confirmed. Please retry.', receipt: null });
    });
    return () => { cancelled = true; };
  }, [accountKey, identity, attempt]);

  const retry = () => {
    if (busy.current) return;
    busy.current = true;
    setAttempt((value) => value + 1);
  };
  return { ...state, retry };
}
