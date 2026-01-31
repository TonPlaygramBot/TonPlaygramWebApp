import { useEffect } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';

export default function TonConnectSync() {
  const [tonConnectUI] = useTonConnectUI();

  useEffect(() => {
    let cancelled = false;
    tonConnectUI.connectionRestored.then((restored) => {
      if (!restored || cancelled) return;
      const address = tonConnectUI.account?.address;
      if (address) {
        localStorage.setItem('walletAddress', address);
      }
    });

    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      const address = wallet?.account?.address || '';
      if (address) {
        localStorage.setItem('walletAddress', address);
        tonConnectUI.closeModal();
      } else {
        localStorage.removeItem('walletAddress');
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [tonConnectUI]);

  return null;
}
