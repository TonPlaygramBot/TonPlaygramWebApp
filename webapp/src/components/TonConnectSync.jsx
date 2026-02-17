import { useEffect } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';

export default function TonConnectSync() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const syncWalletAddress = (address) => {
    if (address) {
      localStorage.setItem('walletAddress', address);
      tonConnectUI.closeModal();
    } else {
      localStorage.removeItem('walletAddress');
    }
  };

  useEffect(() => {
    const address = wallet?.account?.address || '';
    if (address) {
      syncWalletAddress(address);
    }
  }, [wallet]);

  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      const address = wallet?.account?.address || '';
      syncWalletAddress(address);
    });

    return () => unsubscribe();
  }, [tonConnectUI]);

  return null;
}
