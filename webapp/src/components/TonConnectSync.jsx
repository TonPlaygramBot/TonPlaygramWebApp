import { useEffect } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';

export default function TonConnectSync() {
  const [tonConnectUI] = useTonConnectUI();

  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      const address = wallet?.account?.address || '';
      if (address) {
        localStorage.setItem('walletAddress', address);
        tonConnectUI.closeModal();
      } else {
        localStorage.removeItem('walletAddress');
      }
    });

    return () => unsubscribe();
  }, [tonConnectUI]);

  return null;
}
