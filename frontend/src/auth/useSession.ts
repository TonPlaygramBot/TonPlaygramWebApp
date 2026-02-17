import { useCallback, useState } from 'react';
import { api } from '../lib/api';

export type Wallet = { id: string; chain: 'solana' | 'evm' | 'ton'; address: string; provider?: string; isPrimary: boolean };
export type Account = {
  id: string;
  telegramUserId?: string | null;
  telegramUsername?: string | null;
  googleSub?: string | null;
  googleEmail?: string | null;
  primaryAuthMethod: string;
};

export function useSession() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [account, setAccount] = useState<Account>();
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const refresh = useCallback(async () => {
    const data = await api<{ ok: true; account: Account; wallets: Wallet[] }>('/api/me');
    setAccount(data.account);
    setWallets(data.wallets);
  }, []);

  const logout = async () => {
    await api('/api/logout', { method: 'POST' });
    setAccount(undefined);
    setWallets([]);
  };

  const consumeAuth = (data: { account: Account; wallets: Wallet[] }) => {
    setAccount(data.account);
    setWallets(data.wallets);
  };

  const run = async <T,>(fn: () => Promise<T>) => {
    setLoading(true);
    setError(undefined);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, account, wallets, refresh, logout, consumeAuth, run, setError };
}
