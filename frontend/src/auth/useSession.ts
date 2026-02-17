import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getTelegramInitData } from '../lib/telegram';

export type Wallet = {
  id: string;
  chain: 'solana' | 'evm' | 'ton';
  address: string;
  provider?: string;
  isPrimary: boolean;
};

export type SessionState = {
  loading: boolean;
  missingTelegram: boolean;
  error?: string;
  account?: { id: string; telegramUserId: string; telegramUsername?: string };
  wallets: Wallet[];
  refresh: () => Promise<void>;
};

export function useSession(): SessionState {
  const [loading, setLoading] = useState(true);
  const [missingTelegram, setMissingTelegram] = useState(false);
  const [error, setError] = useState<string>();
  const [account, setAccount] = useState<SessionState['account']>();
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const refresh = async () => {
    const me = await api<{ account: SessionState['account']; wallets: Wallet[] }>('/api/me');
    setAccount(me.account);
    setWallets(me.wallets);
  };

  useEffect(() => {
    (async () => {
      try {
        const initData = getTelegramInitData();
        if (!initData) {
          setMissingTelegram(true);
          return;
        }
        const data = await api<{ account: SessionState['account']; wallets: Wallet[] }>('/api/auth/telegram', {
          method: 'POST',
          body: JSON.stringify({ initData }),
        });
        setAccount(data.account);
        setWallets(data.wallets);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { loading, missingTelegram, error, account, wallets, refresh };
}
