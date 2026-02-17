import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { api } from '../../lib/api';

export function TonLink({ onDone }: { onDone: () => Promise<void> }) {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();

  const link = async () => {
    const { nonce, tonProofPayload } = await api<{ nonce: string; tonProofPayload: string }>('/api/wallets/link/nonce?chain=ton');

    tonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: tonProofPayload } });
    if (!address) {
      await tonConnectUI.openModal();
      throw new Error('Please connect wallet first, then tap again to submit proof');
    }

    const wallet = tonConnectUI.wallet as any;
    const tonProof = wallet?.connectItems?.tonProof?.proof;
    if (!tonProof) throw new Error('TON proof is not available from connected wallet');

    await api('/api/wallets/link/verify', {
      method: 'POST',
      body: JSON.stringify({
        chain: 'ton',
        address,
        provider: wallet?.device?.appName,
        nonce,
        tonProof: {
          timestamp: tonProof.timestamp,
          domain: tonProof.domain,
          signature: tonProof.signature,
          payload: tonProof.payload,
          publicKey: tonProof.publicKey,
        },
      }),
    });
    await onDone();
  };

  return <button onClick={() => link().catch((e) => alert(e.message))}>{address ? 'Submit TON proof & Link' : 'Connect TON Wallet'}</button>;
}
