import { useMemo, useState } from 'react';
import { AddWalletModal } from './AddWalletModal';

export function WalletsScreen({ session }: { session: any }) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(
    () => ({
      solana: session.wallets.filter((w: any) => w.chain === 'solana'),
      evm: session.wallets.filter((w: any) => w.chain === 'evm'),
      ton: session.wallets.filter((w: any) => w.chain === 'ton'),
    }),
    [session.wallets],
  );

  return (
    <div>
      <h2>TPC account wallets</h2>
      <button onClick={() => setOpen(true)}>Add wallet</button>
      {(['solana', 'evm', 'ton'] as const).map((chain) => (
        <section key={chain}>
          <h3>{chain.toUpperCase()}</h3>
          {grouped[chain].map((wallet: any) => (
            <div key={wallet.id}>{wallet.address} {wallet.isPrimary ? '(primary)' : ''}</div>
          ))}
          {grouped[chain].length === 0 && <p>No wallets linked.</p>}
        </section>
      ))}
      {open && <AddWalletModal onClose={() => setOpen(false)} onDone={session.refresh} />}
    </div>
  );
}
