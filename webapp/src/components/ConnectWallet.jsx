import { useEffect } from 'react';
import { TonConnectButton, useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';

// Simple wrapper around TonConnectButton that remembers the last connected
// address in localStorage.
export default function ConnectWallet() {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  // Persist address when wallet changes
  useEffect(() => {
    if (wallet?.account?.address) {
      localStorage.setItem('walletAddress', wallet.account.address);
    }
  }, [wallet]);

  const handleClick = () => {
    if (!wallet?.account?.address) {
      tonConnectUI.openModal().catch(() => {});
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <TonConnectButton className="ton-connect-button" onClick={handleClick} />
      {wallet?.account?.address && (
        <span className="text-sm">
          {wallet.account.address.slice(0, 4)}...
          {wallet.account.address.slice(-4)}
        </span>
      )}
    </div>
  );
}
