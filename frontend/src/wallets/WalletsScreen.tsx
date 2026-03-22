import { useEffect, useMemo, useState } from 'react';
import type { SessionState } from '../auth/useSession';
import { AddWalletModal } from './AddWalletModal';
import { getWalletBalance } from './balance/getWalletBalance';

type BalanceState = Record<string, { loading: boolean; value?: string; error?: string }>;

function chainLabel(chain: 'solana' | 'evm' | 'ton') {
  if (chain === 'evm') return 'BNB';
  if (chain === 'ton') return 'TON';
  return 'Solana';
}

export function WalletsScreen({ session }: { session: SessionState }) {
  const [open, setOpen] = useState(false);
  const [balances, setBalances] = useState<BalanceState>({});

  const grouped = useMemo(() => {
    return {
      solana: session.wallets.filter((w) => w.chain === 'solana'),
      evm: session.wallets.filter((w) => w.chain === 'evm'),
      ton: session.wallets.filter((w) => w.chain === 'ton'),
    };
  }, [session.wallets]);

  useEffect(() => {
    let cancelled = false;

    const loadBalances = async () => {
      const initial: BalanceState = {};
      for (const wallet of session.wallets) {
        initial[wallet.id] = { loading: true };
      }
      setBalances(initial);

      await Promise.all(
        session.wallets.map(async (wallet) => {
          try {
            const balance = await getWalletBalance({ chain: wallet.chain, address: wallet.address });
            if (cancelled) return;
            setBalances((prev) => ({ ...prev, [wallet.id]: { loading: false, value: `${balance.formatted} ${balance.symbol}` } }));
          } catch {
            if (cancelled) return;
            setBalances((prev) => ({ ...prev, [wallet.id]: { loading: false, error: 'Balance unavailable' } }));
          }
        }),
      );
    };

    void loadBalances();
    return () => {
      cancelled = true;
    };
  }, [session.wallets]);

  return (
    <div>
      <h2>Tpc Account: {session.account?.telegramUserId}</h2>
      <button onClick={() => setOpen(true)}>Add wallet</button>
      {(['solana', 'evm', 'ton'] as const).map((chain) => (
        <section key={chain}>
          <h3>{chainLabel(chain)}</h3>
          {grouped[chain].map((wallet) => {
            const balance = balances[wallet.id];
            return (
              <div key={wallet.id} style={{ marginBottom: 8 }}>
                <div>
                  {wallet.address} {wallet.isPrimary ? '(primary)' : ''}
                </div>
                <div style={{ color: '#555' }}>
                  {balance?.loading && 'Balance: loading...'}
                  {!balance?.loading && balance?.value && `Balance: ${balance.value}`}
                  {!balance?.loading && balance?.error && `Balance: ${balance.error}`}
                </div>
              </div>
            );
          })}
          {grouped[chain].length === 0 && <p>No wallets linked.</p>}
        </section>
      ))}
      {open && <AddWalletModal onClose={() => setOpen(false)} onDone={session.refresh} />}
    </div>
  );
}
