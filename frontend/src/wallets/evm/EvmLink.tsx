import { useAccount, useConnect, useSignMessage } from 'wagmi';
import { api } from '../../lib/api';

export function EvmLink({ onDone }: { onDone: () => Promise<void> }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();

  const link = async () => {
    if (!isConnected) {
      const wc = connectors[0];
      if (!wc) throw new Error('WalletConnect connector missing');
      connect({ connector: wc });
      return;
    }
    if (!address) throw new Error('No EVM address');

    const nonceResp = await api<{ nonce: string; message: string }>('/api/wallets/link/nonce?chain=evm');
    const signature = await signMessageAsync({ message: nonceResp.message });

    await api('/api/wallets/link/verify', {
      method: 'POST',
      body: JSON.stringify({
        chain: 'evm',
        address,
        provider: 'walletconnect',
        nonce: nonceResp.nonce,
        message: nonceResp.message,
        signature,
      }),
    });
    await onDone();
  };

  return <button onClick={() => link().catch((e) => alert(e.message))}>{isConnected ? 'Sign & Link EVM' : 'Connect WalletConnect'}</button>;
}
