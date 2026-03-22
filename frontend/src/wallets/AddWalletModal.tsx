import { useState } from 'react';
import { SolanaLink } from './solana/SolanaLink';
import { EvmLink } from './evm/EvmLink';
import { TonLink } from './ton/TonLink';

type ChainTab = 'solana' | 'evm' | 'ton';

const TAB_LABEL: Record<ChainTab, string> = {
  solana: 'Solana',
  evm: 'BNB',
  ton: 'TON',
};

export function AddWalletModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [chain, setChain] = useState<ChainTab>('solana');

  return (
    <div style={{ border: '1px solid #ccc', padding: 12, borderRadius: 10, background: '#fff' }}>
      <h4 style={{ marginTop: 0 }}>Link wallet</h4>
      <p style={{ marginTop: 0, color: '#666' }}>Choose one wallet network to connect.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {(['solana', 'evm', 'ton'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setChain(tab)}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              border: '1px solid #ccc',
              background: chain === tab ? '#111' : '#fff',
              color: chain === tab ? '#fff' : '#111',
            }}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {chain === 'solana' && <SolanaLink onDone={onDone} />}
      {chain === 'evm' && <EvmLink onDone={onDone} />}
      {chain === 'ton' && <TonLink onDone={onDone} />}

      <div style={{ marginTop: 12 }}>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
