import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '../../lib/api';

export function SolanaLink({ onDone }: { onDone: () => Promise<void> }) {
  const wallet = useWallet();

  const link = async () => {
    if (!wallet.connected) await wallet.connect();
    if (!wallet.publicKey) throw new Error('No Solana public key');
    if (!wallet.signMessage) throw new Error('Wallet does not support signMessage');

    const nonceResp = await api<{ nonce: string; message: string }>('/api/wallets/link/nonce?chain=solana');
    const sig = await wallet.signMessage(new TextEncoder().encode(nonceResp.message));
    await api('/api/wallets/link/verify', {
      method: 'POST',
      body: JSON.stringify({
        chain: 'solana',
        address: wallet.publicKey.toBase58(),
        provider: 'phantom',
        nonce: nonceResp.nonce,
        message: nonceResp.message,
        signature: Array.from(sig),
      }),
    });
    await onDone();
  };

  return <button onClick={() => link().catch((e) => alert(e.message))}>Connect Phantom & Link</button>;
}
