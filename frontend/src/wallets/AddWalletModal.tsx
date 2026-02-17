import { useState } from 'react';
import { SolanaLink } from './solana/SolanaLink';
import { EvmLink } from './evm/EvmLink';
import { TonLink } from './ton/TonLink';

export function AddWalletModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [chain, setChain] = useState<'solana' | 'evm' | 'ton'>('solana');

  return (
    <div style={{ border: '1px solid #ccc', padding: 12 }}>
      <h4>Link wallet</h4>
      <select value={chain} onChange={(e) => setChain(e.target.value as typeof chain)}>
        <option value="solana">Solana</option>
        <option value="evm">EVM</option>
        <option value="ton">TON</option>
      </select>

      {chain === 'solana' && <SolanaLink onDone={onDone} />}
      {chain === 'evm' && <EvmLink onDone={onDone} />}
      {chain === 'ton' && <TonLink onDone={onDone} />}

      <button onClick={onClose}>Close</button>
    </div>
  );
}
