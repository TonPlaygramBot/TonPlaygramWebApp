import { useEffect } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';

// Simple wrapper around TonConnectButton that remembers the last connected
// address in localStorage.
export default function ConnectWallet() {
  const wallet = useTonWallet();

  // Persist address when wallet changes
  useEffect(() => {
    if (wallet?.account?.address) {
      localStorage.setItem('walletAddress', wallet.account.address);
    }
  }, [wallet]);

  return (
    <div className="flex items-center space-x-2">
      <TonConnectButton className="ton-connect-button" />
      {wallet?.account?.address && (
        <span className="text-sm">
          {wallet.account.address.slice(0, 4)}...
          {wallet.account.address.slice(-4)}
        </span>
      )}
    </div>
  );
}
