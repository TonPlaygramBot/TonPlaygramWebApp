import { useEffect } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

export default function TonConnectSync() {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress(true);

  const syncWalletAddress = (address) => {
    if (address) {
      localStorage.setItem('walletAddress', address);
      tonConnectUI.closeModal();
    } else {
      localStorage.removeItem('walletAddress');
    }
  };

  useEffect(() => {
    syncWalletAddress(tonAddress || '');
  }, [tonAddress]);

  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      const address = wallet?.account?.address || '';
      syncWalletAddress(address);
    });

    return () => unsubscribe();
  }, [tonConnectUI]);

  return null;
}
